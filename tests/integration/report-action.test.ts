import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePublicCode } from "@/lib/public-code";
import { HONEYPOT_FIELD } from "@/lib/validators/reports";
import { db } from "@/server/db";
import { hashIp } from "@/server/client-ip";
import {
  submitReportAction,
  type SubmitReportState,
} from "@/server/reports/actions";
import { ANONYMOUS_REPORT_LIMITS } from "@/server/reports/rate-limit";
import { resetDb } from "./reset-db";

const request = vi.hoisted(() => ({
  user: null as null | { id: string; role: string; isActive: boolean },
  headers: new Headers(),
}));

vi.mock("@/server/auth/session", () => ({
  getSession: async () => request.user,
}));

vi.mock("next/headers", () => ({
  headers: async () => request.headers,
}));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

const IP = "203.0.113.7";
const idle: SubmitReportState = { ok: false };

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

function submit(code: string, values: Record<string, string>) {
  return submitReportAction(code, idle, formData(values));
}

let asset: { id: string; publicCode: string };

beforeEach(async () => {
  await resetDb();
  request.user = null;
  request.headers = new Headers({ "x-forwarded-for": `${IP}, 10.0.0.1` });
  revalidatePath.mockClear();

  const location = await db.location.create({
    data: { building: "Edificio C", room: "Aula 3" },
  });
  asset = await db.asset.create({
    data: {
      publicCode: generatePublicCode(),
      inventoryNumber: "ACT-1",
      name: "Proyector",
      type: "PROJECTOR",
      locationId: location.id,
    },
    select: { id: true, publicCode: true },
  });
});

afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("submitReportAction", () => {
  it("un anónimo crea el reporte, su evento y el activo pasa a falla reportada", async () => {
    const result = await submit(asset.publicCode, {
      description: "No enciende",
      faultType: "POWER",
      reporterName: "Ana",
      reporterEmail: "ana@escuela.mx",
      [HONEYPOT_FIELD]: "",
    });

    expect(result).toEqual({ ok: true, data: { folio: 1 } });

    const report = await db.report.findUniqueOrThrow({
      where: { folio: 1 },
      include: { events: true, asset: { select: { status: true } } },
    });
    expect(report).toMatchObject({
      description: "No enciende",
      faultType: "POWER",
      reporterName: "Ana",
      reporterEmail: "ana@escuela.mx",
      status: "REPORTED",
      asset: { status: "FAULT_REPORTED" },
    });
    expect(report.events).toEqual([
      expect.objectContaining({ type: "CREATED", actorId: null }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/a/${asset.publicCode}`);
  });

  it("guarda el hash de la IP, nunca la IP", async () => {
    await submit(asset.publicCode, { description: "No enciende" });

    const report = await db.report.findUniqueOrThrow({ where: { folio: 1 } });
    expect(report.reporterIpHash).toBe(hashIp(IP));
    expect(JSON.stringify(report)).not.toContain(IP);
  });

  it("con el campo trampa lleno rechaza sin crear nada", async () => {
    const result = await submit(asset.publicCode, {
      description: "Compra ya",
      [HONEYPOT_FIELD]: "https://spam.example",
    });

    expect(result).toEqual({ ok: false, message: expect.any(String) });
    await expect(db.report.count()).resolves.toBe(0);
    await expect(
      db.asset.findUniqueOrThrow({ where: { id: asset.id } }),
    ).resolves.toMatchObject({ status: "OPERATIONAL" });
  });

  it("devuelve los errores de validación por campo", async () => {
    const result = await submit(asset.publicCode, {
      description: "",
      reporterEmail: "ana@",
    });

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        description: "Describe la falla.",
        reporterEmail: "Escribe un correo válido.",
      },
    });
    await expect(db.report.count()).resolves.toBe(0);
  });

  it("con un código de activo inexistente responde con un error claro", async () => {
    const result = await submit("zzzzzzzzzzzz", { description: "Falla" });

    expect(result).toEqual({
      ok: false,
      message: "No encontramos este equipo.",
    });
    await expect(db.report.count()).resolves.toBe(0);
  });

  it("al superar el límite responde con un mensaje claro", async () => {
    for (let i = 0; i < ANONYMOUS_REPORT_LIMITS.perAsset; i++) {
      await expect(
        submit(asset.publicCode, { description: `Falla ${i}` }),
      ).resolves.toMatchObject({ ok: true });
    }

    const result = await submit(asset.publicCode, { description: "Otra" });

    expect(result).toEqual({
      ok: false,
      message: expect.stringMatching(/varios reportes en la última hora/),
    });
    await expect(db.report.count()).resolves.toBe(
      ANONYMOUS_REPORT_LIMITS.perAsset,
    );
  });

  it("sin IP conocida igual crea el reporte", async () => {
    request.headers = new Headers();

    await expect(
      submit(asset.publicCode, { description: "Falla" }),
    ).resolves.toEqual({ ok: true, data: { folio: 1 } });
    await expect(
      db.report.findUniqueOrThrow({ where: { folio: 1 } }),
    ).resolves.toMatchObject({ reporterIpHash: null });
  });

  it("con sesión registra al usuario como actor", async () => {
    const staff = await db.user.create({
      data: { name: "Staff", email: "staff@test.mx", role: "STAFF" },
    });
    request.user = { id: staff.id, role: "STAFF", isActive: true };

    await submit(asset.publicCode, { description: "Falla" });

    const event = await db.reportEvent.findFirstOrThrow();
    expect(event.actorId).toBe(staff.id);
  });
});
