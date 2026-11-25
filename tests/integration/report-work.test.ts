import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { generatePublicCode } from "@/lib/public-code";
import { AuthorizationError } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import {
  commentReportAction,
  resolveReportAction,
  startReportAction,
} from "@/server/reports/actions";
import { InvalidTransitionError } from "@/server/reports/errors";
import {
  listMyReports,
  MY_RECENT_CLOSED_LIMIT,
} from "@/server/reports/queries";
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

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

let sequence = 0;

async function newUser(role: UserRole): Promise<Actor> {
  const n = ++sequence;
  const user = await db.user.create({
    data: { name: `${role} ${n}`, email: `w${n}@test.mx`, role },
  });

  return { id: user.id, role: user.role, isActive: user.isActive };
}

async function ok(promise: Promise<{ ok: boolean }>) {
  const result = await promise;

  if (!result.ok) throw new Error(`Falló: ${JSON.stringify(result)}`);
}

function form(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) data.set(key, value);

  return data;
}

let admin: Actor;
let staff: Actor;
let tech: Actor;
let otherTech: Actor;
let asset: { id: string; publicCode: string };

async function reported(description = "No enciende") {
  // Con sesión: el límite de reportes anónimos por activo no aplica.
  const result = await createReport(admin, asset.publicCode, { description });

  if (!result.ok) throw new Error("No se pudo crear el reporte de prueba.");

  return result.data.id;
}

async function assigned(technician = tech) {
  const id = await reported();
  await ok(assignReport(admin, id, { technicianId: technician.id }));

  return id;
}

async function inProgress(technician = tech) {
  const id = await assigned(technician);
  await ok(changeReportStatus(technician, id, { status: "IN_PROGRESS" }));

  return id;
}

async function resolved(technician = tech) {
  const id = await inProgress(technician);
  await ok(
    changeReportStatus(technician, id, { status: "RESOLVED", note: "Listo" }),
  );

  return id;
}

const reportOf = (id: string) => db.report.findUniqueOrThrow({ where: { id } });
const eventCount = (reportId: string) =>
  db.reportEvent.count({ where: { reportId } });
const assetStatus = async () =>
  (await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status;

beforeEach(async () => {
  await resetDb();
  revalidatePath.mockClear();
  [admin, staff, tech, otherTech] = await Promise.all([
    newUser("ADMIN"),
    newUser("STAFF"),
    newUser("TECHNICIAN"),
    newUser("TECHNICIAN"),
  ]);
  session.user = tech;

  const location = await db.location.create({
    data: { building: "Edificio E", room: "Taller" },
  });
  asset = await db.asset.create({
    data: {
      publicCode: generatePublicCode(),
      inventoryNumber: `INV-W-${++sequence}`,
      name: "Osciloscopio",
      type: "LAB_EQUIPMENT",
      locationId: location.id,
    },
    select: { id: true, publicCode: true },
  });
});
afterAll(() => db.$disconnect());

describe("addReportComment", () => {
  it("el técnico anota su reporte sin cambiar el estado", async () => {
    const id = await inProgress();

    await ok(addReportComment(tech, id, { message: "  Falta una pieza  " }));

    expect((await reportOf(id)).status).toBe("IN_PROGRESS");
    await expect(assetStatus()).resolves.toBe("IN_MAINTENANCE");
    const last = await db.reportEvent.findFirstOrThrow({
      where: { reportId: id },
      orderBy: { createdAt: "desc" },
    });
    expect(last).toMatchObject({
      type: "COMMENT",
      actorId: tech.id,
      message: "Falta una pieza",
      fromStatus: "IN_PROGRESS",
      toStatus: "IN_PROGRESS",
    });
  });

  it("el ADMIN anota cualquier reporte abierto, incluso sin asignar", async () => {
    const id = await reported();

    await ok(addReportComment(admin, id, { message: "Revisar mañana" }));

    expect((await reportOf(id)).status).toBe("REPORTED");
    await expect(eventCount(id)).resolves.toBe(2);
  });

  it("exige el texto de la nota", async () => {
    const id = await assigned();

    await expect(
      addReportComment(tech, id, { message: "   " }),
    ).resolves.toEqual({
      ok: false,
      fieldErrors: { message: "Escribe la nota." },
    });
    await expect(eventCount(id)).resolves.toBe(2);
  });

  it("no anota un reporte cerrado", async () => {
    const id = await resolved();

    await expect(
      addReportComment(tech, id, { message: "Otra cosa" }),
    ).rejects.toThrow(
      new InvalidTransitionError("RESOLVED", "comment").message,
    );
  });

  it.each<[string, () => Viewer]>([
    ["anónimo", () => null],
    ["administrativo", () => staff],
    ["otro técnico", () => otherTech],
  ])("%s no puede anotar", async (_name, viewer) => {
    const id = await assigned();

    await expect(
      addReportComment(viewer(), id, { message: "Hola" }),
    ).rejects.toThrow(AuthorizationError);
    await expect(eventCount(id)).resolves.toBe(2);
  });
});

describe("un técnico no actúa sobre reportes de otros", () => {
  it("no inicia, anota ni resuelve el reporte de otro técnico", async () => {
    const mine = await assigned(otherTech);
    const theirs = await inProgress(otherTech);
    const before = await reportOf(theirs);

    await expect(
      changeReportStatus(tech, mine, { status: "IN_PROGRESS" }),
    ).rejects.toThrow(AuthorizationError);
    await expect(
      changeReportStatus(tech, theirs, { status: "RESOLVED", note: "Hecho" }),
    ).rejects.toThrow(AuthorizationError);
    await expect(
      addReportComment(tech, theirs, { message: "Hola" }),
    ).rejects.toThrow(AuthorizationError);

    expect((await reportOf(mine)).status).toBe("ASSIGNED");
    expect(await reportOf(theirs)).toEqual(before);
  });

  it("tampoco asigna, prioriza ni rechaza, ni en su propio reporte", async () => {
    const id = await assigned();

    await expect(
      assignReport(tech, id, { technicianId: otherTech.id }),
    ).rejects.toThrow(AuthorizationError);
    await expect(
      setReportPriority(tech, id, { priority: "HIGH" }),
    ).rejects.toThrow(AuthorizationError);
    await expect(rejectReport(tech, id, { reason: "No" })).rejects.toThrow(
      AuthorizationError,
    );
  });
});

describe("acciones del técnico desde el detalle", () => {
  it("iniciar con nota opcional vuelve al detalle con aviso", async () => {
    const id = await assigned();

    await expect(
      startReportAction(id, { ok: false }, form({ note: "" })),
    ).rejects.toThrow(`/reportes/${id}?aviso=en-proceso`);

    expect((await reportOf(id)).status).toBe("IN_PROGRESS");
    await expect(assetStatus()).resolves.toBe("IN_MAINTENANCE");
    expect(revalidatePath).toHaveBeenCalledWith("/mis-reportes");
    expect(revalidatePath).toHaveBeenCalledWith(`/reportes/${id}`);
  });

  it("el estado lo fija la acción, no el formulario", async () => {
    const id = await assigned();

    await expect(
      startReportAction(id, { ok: false }, form({ status: "RESOLVED" })),
    ).rejects.toThrow("aviso=en-proceso");

    expect((await reportOf(id)).status).toBe("IN_PROGRESS");
  });

  it("resolver sin nota pide la nota y no cambia nada", async () => {
    const id = await inProgress();

    expect(
      await resolveReportAction(id, { ok: false }, form({ note: "  " })),
    ).toEqual({
      ok: false,
      fieldErrors: { note: "Escribe qué se hizo para resolverlo." },
    });
    expect((await reportOf(id)).status).toBe("IN_PROGRESS");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("resolver con nota cierra el reporte y el equipo vuelve a funcionar", async () => {
    const id = await inProgress();

    await expect(
      resolveReportAction(id, { ok: false }, form({ note: "Cambio de cable" })),
    ).rejects.toThrow("aviso=resuelto");

    expect(await reportOf(id)).toMatchObject({
      status: "RESOLVED",
      resolutionNote: "Cambio de cable",
    });
    expect((await reportOf(id)).resolvedAt).toBeInstanceOf(Date);
    await expect(assetStatus()).resolves.toBe("OPERATIONAL");
  });

  it("guardar una nota avisa", async () => {
    const id = await assigned();

    await expect(
      commentReportAction(
        id,
        { ok: false },
        form({ message: "Voy en camino" }),
      ),
    ).rejects.toThrow("aviso=nota");
  });

  it("sobre un reporte ajeno recibe el mensaje de permiso", async () => {
    const id = await assigned(otherTech);

    expect(await startReportAction(id, { ok: false }, form({}))).toEqual({
      ok: false,
      message: "No tienes permiso para realizar esta acción.",
    });
    expect(
      await commentReportAction(id, { ok: false }, form({ message: "Hola" })),
    ).toEqual({
      ok: false,
      message: "No tienes permiso para realizar esta acción.",
    });
    expect((await reportOf(id)).status).toBe("ASSIGNED");
  });

  it("un paso fuera de orden da un mensaje claro", async () => {
    const id = await assigned();

    expect(
      await resolveReportAction(id, { ok: false }, form({ note: "Hecho" })),
    ).toEqual({
      ok: false,
      message: "No se puede resolver un reporte en estado «Asignado».",
    });
  });
});

describe("listMyReports", () => {
  it("agrupa en proceso, por iniciar y cerrados; solo los propios", async () => {
    const working = await inProgress();
    const pending = await assigned();
    const done = await resolved();
    const rejected = await assigned();
    await ok(rejectReport(admin, rejected, { reason: "Duplicado" }));
    await inProgress(otherTech);
    await assigned(otherTech);
    await reported();

    const mine = await listMyReports(tech);

    expect(mine.inProgress.map((r) => r.id)).toEqual([working]);
    expect(mine.assigned.map((r) => r.id)).toEqual([pending]);
    expect(mine.recentlyClosed.map((r) => r.id).sort()).toEqual(
      [done, rejected].sort(),
    );
  });

  it("la prioridad alta va primero dentro de cada grupo", async () => {
    const first = await assigned();
    const urgent = await assigned();
    await ok(setReportPriority(admin, urgent, { priority: "HIGH" }));

    const { assigned: pending } = await listMyReports(tech);

    expect(pending.map((r) => r.id)).toEqual([urgent, first]);
  });

  it("al reasignar, el reporte pasa al otro técnico", async () => {
    const id = await assigned();
    await ok(assignReport(admin, id, { technicianId: otherTech.id }));

    expect((await listMyReports(tech)).assigned).toEqual([]);
    expect((await listMyReports(otherTech)).assigned.map((r) => r.id)).toEqual([
      id,
    ]);
  });

  // Recorre 11 reportes por todo el flujo: tarda ~4 s y con la suite completa rebasaba los 5 s.
  it(
    `limita los cerrados a los ${MY_RECENT_CLOSED_LIMIT} más recientes`,
    { timeout: 20_000 },
    async () => {
      const ids: string[] = [];
      for (let i = 0; i <= MY_RECENT_CLOSED_LIMIT; i++) {
        ids.push(await resolved());
      }

      const { recentlyClosed } = await listMyReports(tech);

      expect(recentlyClosed).toHaveLength(MY_RECENT_CLOSED_LIMIT);
      expect(recentlyClosed.map((r) => r.id)).not.toContain(ids[0]);
    },
  );

  it("no expone contacto ni hash de IP de quien reportó", async () => {
    await assigned();

    const { assigned: pending } = await listMyReports(tech);

    expect(Object.keys(pending[0]).sort()).toEqual(
      [
        "asset",
        "assignedAt",
        "createdAt",
        "description",
        "folio",
        "id",
        "priority",
        "resolvedAt",
        "status",
      ].sort(),
    );
  });

  it("sin sesión no entra", async () => {
    await expect(listMyReports(null)).rejects.toThrow(AuthorizationError);
  });
});
