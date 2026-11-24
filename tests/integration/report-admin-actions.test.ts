import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { generatePublicCode } from "@/lib/public-code";
import { db } from "@/server/db";
import {
  assignReportAction,
  rejectReportAction,
  setReportPriorityAction,
} from "@/server/reports/actions";
import { createReport } from "@/server/reports/service";
import { resetDb } from "./reset-db";

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

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

function form(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) data.set(key, value);

  return data;
}

async function userWith(role: UserRole) {
  const user = await db.user.create({
    data: { name: role, email: `${role.toLowerCase()}@test.mx`, role },
  });

  return { id: user.id, role: user.role, isActive: user.isActive };
}

let reportId: string;
let technicianId: string;

beforeEach(async () => {
  await resetDb();
  revalidatePath.mockClear();
  session.user = await userWith("ADMIN");
  technicianId = (await userWith("TECHNICIAN")).id;

  const location = await db.location.create({
    data: { building: "Edificio D", room: "Aula 1" },
  });
  const asset = await db.asset.create({
    data: {
      publicCode: generatePublicCode(),
      inventoryNumber: "ACT-7",
      name: "Pantalla",
      type: "DISPLAY",
      locationId: location.id,
    },
  });
  const created = await createReport(null, asset.publicCode, {
    description: "Sin señal",
  });
  if (!created.ok) throw new Error("No se creó el reporte.");
  reportId = created.data.id;
});
afterAll(() => db.$disconnect());

describe("acciones del ADMIN sobre un reporte", () => {
  it("asignar vuelve al detalle con aviso y revalida la bandeja", async () => {
    await expect(
      assignReportAction(reportId, { ok: false }, form({ technicianId })),
    ).rejects.toThrow(`/reportes/${reportId}?aviso=asignado`);

    expect(
      await db.report.findUniqueOrThrow({ where: { id: reportId } }),
    ).toMatchObject({ status: "ASSIGNED", assignedToId: technicianId });
    expect(revalidatePath).toHaveBeenCalledWith("/reportes");
    expect(revalidatePath).toHaveBeenCalledWith(`/reportes/${reportId}`);
  });

  it("prioridad y rechazo también avisan", async () => {
    await expect(
      setReportPriorityAction(
        reportId,
        { ok: false },
        form({ priority: "HIGH" }),
      ),
    ).rejects.toThrow("aviso=prioridad");
    await expect(
      rejectReportAction(
        reportId,
        { ok: false },
        form({ reason: "Duplicado" }),
      ),
    ).rejects.toThrow("aviso=rechazado");

    expect(
      await db.report.findUniqueOrThrow({ where: { id: reportId } }),
    ).toMatchObject({
      priority: "HIGH",
      status: "REJECTED",
      resolutionNote: "Duplicado",
    });
  });

  it("STAFF recibe el mensaje de permiso y nada cambia", async () => {
    session.user = await userWith("STAFF");

    expect(
      await assignReportAction(reportId, { ok: false }, form({ technicianId })),
    ).toEqual({
      ok: false,
      message: "No tienes permiso para realizar esta acción.",
    });
    expect(
      await db.report.findUniqueOrThrow({ where: { id: reportId } }),
    ).toMatchObject({ status: "REPORTED", assignedToId: null });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("los errores de dominio y de campo vuelven al formulario", async () => {
    expect(
      await assignReportAction(
        reportId,
        { ok: false },
        form({ technicianId: session.user!.id }),
      ),
    ).toEqual({ ok: false, message: "Elige un técnico activo." });

    expect(
      await rejectReportAction(reportId, { ok: false }, form({ reason: " " })),
    ).toEqual({
      ok: false,
      fieldErrors: { reason: "Escribe el motivo del rechazo." },
    });

    expect(
      await setReportPriorityAction(
        reportId,
        { ok: false },
        form({ priority: "MEDIUM" }),
      ),
    ).toEqual({ ok: false, message: "El reporte ya tiene esa prioridad." });
  });

  it("sin sesión manda al login", async () => {
    session.user = null;

    await expect(
      assignReportAction(reportId, { ok: false }, form({ technicianId })),
    ).rejects.toThrow("/login");
  });
});
