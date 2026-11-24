import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { generatePublicCode } from "@/lib/public-code";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { notify } from "@/server/notifications/notify";
import {
  addReportComment,
  assignReport,
  changeReportStatus,
  createReport,
  rejectReport,
  setReportPriority,
} from "@/server/reports/service";
import { resetDb } from "./reset-db";

type Actor = NonNullable<Viewer>;

let sequence = 0;

async function newUser(role: UserRole, isActive = true): Promise<Actor> {
  const n = ++sequence;
  const user = await db.user.create({
    data: { name: `${role} ${n}`, email: `n${n}@test.mx`, role, isActive },
  });

  return { id: user.id, role: user.role, isActive: user.isActive };
}

async function ok<T>(promise: Promise<{ ok: true; data: T } | { ok: false }>) {
  const result = await promise;

  if (!result.ok) throw new Error(`Falló: ${JSON.stringify(result)}`);

  return result.data;
}

let admin: Actor;
let otherAdmin: Actor;
let inactiveAdmin: Actor;
let staff: Actor;
let tech: Actor;
let otherTech: Actor;
let asset: { id: string; publicCode: string };

async function anonymousReport(description = "No enciende") {
  return ok(createReport(null, asset.publicCode, { description }));
}

async function assignedReport(technician = tech) {
  const { id } = await anonymousReport();
  await ok(assignReport(admin, id, { technicianId: technician.id }));

  return id;
}

async function inProgressReport(technician = tech) {
  const id = await assignedReport(technician);
  await ok(changeReportStatus(technician, id, { status: "IN_PROGRESS" }));

  return id;
}

// Avisos por destinatario, como "tipo:folio", para comparar de un vistazo.
async function inboxes() {
  const rows = await db.notification.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      recipientId: true,
      type: true,
      report: { select: { folio: true } },
    },
  });
  const byRecipient: Record<string, string[]> = {};

  for (const row of rows) {
    (byRecipient[row.recipientId] ??= []).push(
      `${row.type}:${row.report.folio}`,
    );
  }

  return byRecipient;
}

beforeEach(async () => {
  await resetDb();
  [admin, otherAdmin, inactiveAdmin, staff, tech, otherTech] =
    await Promise.all([
      newUser("ADMIN"),
      newUser("ADMIN"),
      newUser("ADMIN", false),
      newUser("STAFF"),
      newUser("TECHNICIAN"),
      newUser("TECHNICIAN"),
    ]);

  const location = await db.location.create({
    data: { building: "Edificio N", room: "Lab 3" },
  });
  asset = await db.asset.create({
    data: {
      publicCode: generatePublicCode(),
      inventoryNumber: `INV-N-${++sequence}`,
      name: "PC de laboratorio",
      type: "COMPUTER",
      locationId: location.id,
    },
    select: { id: true, publicCode: true },
  });
});

afterAll(async () => {
  await resetDb();
});

describe("reglas de avisos", () => {
  it("un reporte anónimo avisa a cada ADMIN activo y a nadie más", async () => {
    const { folio } = await anonymousReport();

    expect(await inboxes()).toEqual({
      [admin.id]: [`REPORT_CREATED:${folio}`],
      [otherAdmin.id]: [`REPORT_CREATED:${folio}`],
    });
  });

  it("el mensaje nombra el folio, el equipo y su ubicación", async () => {
    const { folio } = await anonymousReport();
    const notification = await db.notification.findFirstOrThrow({
      where: { recipientId: admin.id },
    });

    expect(notification.message).toBe(
      `Folio ${folio}: PC de laboratorio en Edificio N, Lab 3.`,
    );
  });

  it("quien reporta con sesión no recibe aviso de su propio reporte", async () => {
    const byAdmin = await ok(
      createReport(admin, asset.publicCode, { description: "Sin red" }),
    );
    const byTech = await ok(
      createReport(tech, asset.publicCode, { description: "Sin imagen" }),
    );

    expect(await inboxes()).toEqual({
      [admin.id]: [`REPORT_CREATED:${byTech.folio}`],
      [otherAdmin.id]: [
        `REPORT_CREATED:${byAdmin.folio}`,
        `REPORT_CREATED:${byTech.folio}`,
      ],
    });
  });

  it("asignar avisa solo al técnico asignado", async () => {
    const { id, folio } = await anonymousReport();
    await db.notification.deleteMany();

    await ok(assignReport(admin, id, { technicianId: tech.id }));

    expect(await inboxes()).toEqual({
      [tech.id]: [`REPORT_ASSIGNED:${folio}`],
    });
    const notification = await db.notification.findFirstOrThrow();
    expect(notification.message).toBe(
      `Te asignaron el folio ${folio}: PC de laboratorio en Edificio N, Lab 3.`,
    );
  });

  it("reasignar avisa al técnico nuevo, no al anterior", async () => {
    const id = await assignedReport(tech);
    const { folio } = await db.report.findUniqueOrThrow({ where: { id } });
    await db.notification.deleteMany();

    await ok(assignReport(admin, id, { technicianId: otherTech.id }));

    expect(await inboxes()).toEqual({
      [otherTech.id]: [`REPORT_ASSIGNED:${folio}`],
    });
  });

  it("resolver avisa a los ADMIN activos; iniciar no avisa", async () => {
    const id = await assignedReport();
    const { folio } = await db.report.findUniqueOrThrow({ where: { id } });
    await db.notification.deleteMany();

    await ok(changeReportStatus(tech, id, { status: "IN_PROGRESS" }));
    expect(await db.notification.count()).toBe(0);

    await ok(
      changeReportStatus(tech, id, { status: "RESOLVED", note: "Cable nuevo" }),
    );

    expect(await inboxes()).toEqual({
      [admin.id]: [`REPORT_RESOLVED:${folio}`],
      [otherAdmin.id]: [`REPORT_RESOLVED:${folio}`],
    });
  });

  it("si resuelve un ADMIN, el aviso va solo a los demás ADMIN", async () => {
    const id = await inProgressReport();
    await db.notification.deleteMany();

    await ok(
      changeReportStatus(admin, id, { status: "RESOLVED", note: "Listo" }),
    );

    expect(Object.keys(await inboxes())).toEqual([otherAdmin.id]);
  });

  it("rechazar, cambiar la prioridad y dejar notas no avisan", async () => {
    const id = await inProgressReport();
    const { id: other } = await anonymousReport("Pantalla azul");
    await db.notification.deleteMany();

    await ok(setReportPriority(admin, id, { priority: "HIGH" }));
    await ok(addReportComment(tech, id, { message: "Falta una pieza" }));
    await ok(rejectReport(admin, other, { reason: "Duplicado" }));

    expect(await db.notification.count()).toBe(0);
  });

  it("los usuarios inactivos no reciben avisos", async () => {
    await anonymousReport();
    const id = await inProgressReport();
    await ok(changeReportStatus(tech, id, { status: "RESOLVED", note: "Ok" }));

    expect(
      await db.notification.count({ where: { recipientId: inactiveAdmin.id } }),
    ).toBe(0);
    expect(
      await db.notification.count({ where: { recipientId: staff.id } }),
    ).toBe(0);
  });

  it("un técnico desactivado tras la asignación no recibe el aviso", async () => {
    const { id } = await anonymousReport();
    await db.notification.deleteMany();

    // La asignación valida al técnico; aquí se desactiva entre la validación y el aviso.
    await db.user.update({ where: { id: tech.id }, data: { isActive: false } });

    await expect(
      notify({
        type: "REPORT_ASSIGNED",
        reportId: id,
        actorId: admin.id,
        assigneeId: tech.id,
      }),
    ).resolves.toBe(0);
  });
});
