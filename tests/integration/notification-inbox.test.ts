import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationType, UserRole } from "@/generated/prisma/enums";
import { generatePublicCode } from "@/lib/public-code";
import { AuthorizationError } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/notifications/actions";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_LIST_LIMIT,
} from "@/server/notifications/service";
import { createReport } from "@/server/reports/service";
import { resetDb } from "./reset-db";

type Actor = NonNullable<Viewer>;

const session = vi.hoisted(() => ({
  user: null as null | { id: string; role: UserRole; isActive: boolean },
}));

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

vi.mock("@/server/auth/session", () => ({
  getSession: async () => session.user,
  requireUser: async () => {
    if (!session.user) throw new RedirectSignal("/login");

    return session.user;
  },
}));

let sequence = 0;

async function newUser(role: UserRole): Promise<Actor> {
  const n = ++sequence;
  const user = await db.user.create({
    data: { name: `${role} ${n}`, email: `i${n}@test.mx`, role },
  });

  return { id: user.id, role: user.role, isActive: user.isActive };
}

let admin: Actor;
let otherAdmin: Actor;
let asset: { publicCode: string };

// Un reporte anónimo real: además avisa a los dos ADMIN.
async function anonymousReport() {
  const result = await createReport(null, asset.publicCode, {
    description: "No enciende",
  });

  if (!result.ok) throw new Error("No se creó el reporte de prueba.");

  return result.data;
}

async function seedNotification(
  recipient: Actor,
  reportId: string,
  overrides: { type?: NotificationType; readAt?: Date; createdAt?: Date } = {},
) {
  return db.notification.create({
    data: {
      recipientId: recipient.id,
      reportId,
      type: "REPORT_CREATED",
      message: "Aviso de prueba",
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  [admin, otherAdmin] = await Promise.all([newUser("ADMIN"), newUser("ADMIN")]);
  session.user = admin;

  const location = await db.location.create({
    data: { building: "Edificio N", room: "Lab 3" },
  });
  asset = await db.asset.create({
    data: {
      publicCode: generatePublicCode(),
      inventoryNumber: `INV-I-${++sequence}`,
      name: "PC de laboratorio",
      type: "COMPUTER",
      locationId: location.id,
    },
    select: { publicCode: true },
  });
});

afterAll(async () => {
  await resetDb();
});

describe("leer y marcar avisos", () => {
  it("cada usuario ve solo sus avisos, del más reciente al más antiguo", async () => {
    const { id } = await anonymousReport();
    await db.notification.deleteMany();
    const older = await seedNotification(admin, id, {
      createdAt: new Date("2026-11-20T10:00:00Z"),
    });
    const newer = await seedNotification(admin, id, {
      type: "REPORT_RESOLVED",
      createdAt: new Date("2026-11-21T10:00:00Z"),
    });
    await seedNotification(otherAdmin, id);

    const feed = await listNotifications(admin);

    expect(feed.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(feed.items[0]).toEqual({
      id: newer.id,
      type: "REPORT_RESOLVED",
      message: "Aviso de prueba",
      reportId: id,
      createdAt: "2026-11-21T10:00:00.000Z",
      readAt: null,
    });
  });

  it("el contador cuenta todas las no leídas, aunque la lista tenga tope", async () => {
    const { id } = await anonymousReport();
    await db.notification.deleteMany();

    for (let i = 0; i < NOTIFICATIONS_LIST_LIMIT + 3; i++) {
      await seedNotification(admin, id);
    }
    await seedNotification(admin, id, { readAt: new Date() });
    await seedNotification(otherAdmin, id);

    const feed = await listNotifications(admin);

    expect(feed.items).toHaveLength(NOTIFICATIONS_LIST_LIMIT);
    expect(feed.unreadCount).toBe(NOTIFICATIONS_LIST_LIMIT + 3);
  });

  it("marcar uno solo afecta a ese aviso y nunca a uno ajeno", async () => {
    const { id } = await anonymousReport();
    await db.notification.deleteMany();
    const mine = await seedNotification(admin, id);
    const alsoMine = await seedNotification(admin, id);
    const theirs = await seedNotification(otherAdmin, id);

    expect(await markNotificationRead(admin, theirs.id)).toBe(0);
    expect(await markNotificationRead(admin, mine.id)).toBe(1);
    expect(await markNotificationRead(admin, mine.id)).toBe(0);
    expect(await markNotificationRead(admin, "no-existe")).toBe(0);
    expect(await markNotificationRead(admin, 42)).toBe(0);

    const readAt = async (notificationId: string) =>
      (
        await db.notification.findUniqueOrThrow({
          where: { id: notificationId },
        })
      ).readAt;

    expect(await readAt(mine.id)).toBeInstanceOf(Date);
    expect(await readAt(alsoMine.id)).toBeNull();
    expect(await readAt(theirs.id)).toBeNull();
    expect((await listNotifications(admin)).unreadCount).toBe(1);
  });

  it("marcar todos solo toca los avisos propios", async () => {
    const { id } = await anonymousReport();
    await db.notification.deleteMany();
    await seedNotification(admin, id);
    await seedNotification(admin, id);
    await seedNotification(otherAdmin, id);

    expect(await markAllNotificationsRead(admin)).toBe(2);
    expect((await listNotifications(admin)).unreadCount).toBe(0);
    expect((await listNotifications(otherAdmin)).unreadCount).toBe(1);
  });

  it("sin sesión activa no se leen ni se marcan avisos", async () => {
    const inactive = { ...admin, isActive: false };

    for (const viewer of [null, inactive]) {
      await expect(listNotifications(viewer)).rejects.toThrow(
        AuthorizationError,
      );
      await expect(markNotificationRead(viewer, "x")).rejects.toThrow(
        AuthorizationError,
      );
      await expect(markAllNotificationsRead(viewer)).rejects.toThrow(
        AuthorizationError,
      );
    }
  });

  it("las acciones marcan con la sesión actual y devuelven la lista al día", async () => {
    const { id } = await anonymousReport();
    await db.notification.deleteMany();
    const first = await seedNotification(admin, id);
    await seedNotification(admin, id);
    const theirs = await seedNotification(otherAdmin, id);

    const afterOne = await markNotificationReadAction(first.id);
    expect(afterOne.unreadCount).toBe(1);

    await markNotificationReadAction(theirs.id);
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: theirs.id } }))
        .readAt,
    ).toBeNull();

    const afterAll = await markAllNotificationsReadAction();
    expect(afterAll.unreadCount).toBe(0);
    expect((await listNotifications(otherAdmin)).unreadCount).toBe(1);
  });

  it("las acciones sin sesión mandan a iniciar sesión", async () => {
    session.user = null;

    await expect(markAllNotificationsReadAction()).rejects.toThrow(
      RedirectSignal,
    );
    await expect(markNotificationReadAction("x")).rejects.toThrow(
      RedirectSignal,
    );
  });
});

describe("GET /api/notifications", () => {
  it("sin sesión responde 401 sin datos", async () => {
    session.user = null;
    const { GET } = await import("@/app/api/notifications/route");

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).not.toHaveProperty("items");
  });

  it("con sesión devuelve solo los avisos propios y el contador", async () => {
    await anonymousReport();
    session.user = otherAdmin;
    const { GET } = await import("@/app/api/notifications/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.unreadCount).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(
      await db.notification.count({
        where: { id: body.items[0].id, recipientId: otherAdmin.id },
      }),
    ).toBe(1);
  });
});
