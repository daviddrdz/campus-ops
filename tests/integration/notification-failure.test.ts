import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePublicCode } from "@/lib/public-code";
import { db } from "@/server/db";
import {
  assignReport,
  changeReportStatus,
  createReport,
} from "@/server/reports/service";
import { resetDb } from "./reset-db";

const notify = vi.hoisted(() => vi.fn());
vi.mock("@/server/notifications/notify", () => ({ notify }));

let publicCode: string;

beforeEach(async () => {
  await resetDb();
  notify.mockReset().mockRejectedValue(new Error("BD de avisos caída"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  const location = await db.location.create({
    data: { building: "Edificio F", room: "Aula 1" },
  });
  ({ publicCode } = await db.asset.create({
    data: {
      publicCode: generatePublicCode(),
      inventoryNumber: "INV-F-1",
      name: "Proyector",
      type: "PROJECTOR",
      locationId: location.id,
    },
    select: { publicCode: true },
  }));
});

afterAll(async () => {
  vi.restoreAllMocks();
  await resetDb();
});

describe("si fallan los avisos", () => {
  it("el reporte, la asignación y la resolución se guardan igual", async () => {
    const [admin, tech] = await Promise.all([
      db.user.create({
        data: { name: "Admin", email: "f1@test.mx", role: "ADMIN" },
      }),
      db.user.create({
        data: { name: "Téc", email: "f2@test.mx", role: "TECHNICIAN" },
      }),
    ]);

    const created = await createReport(null, publicCode, {
      description: "No proyecta",
    });
    if (!created.ok) throw new Error("No se creó el reporte.");
    const { id } = created.data;

    await expect(
      assignReport(admin, id, { technicianId: tech.id }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      changeReportStatus(tech, id, { status: "IN_PROGRESS" }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      changeReportStatus(tech, id, { status: "RESOLVED", note: "Lámpara" }),
    ).resolves.toMatchObject({ ok: true });

    expect(await db.report.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: "RESOLVED",
      assignedToId: tech.id,
    });
    expect(notify.mock.calls.map(([event]) => event.type)).toEqual([
      "REPORT_CREATED",
      "REPORT_ASSIGNED",
      "REPORT_RESOLVED",
    ]);
    expect(console.error).toHaveBeenCalledTimes(3);
  });
});
