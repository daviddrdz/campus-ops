import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { generatePublicCode } from "@/lib/public-code";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { ReportRateLimitError } from "@/server/reports/errors";
import { ANONYMOUS_REPORT_LIMITS } from "@/server/reports/rate-limit";
import { createReport } from "@/server/reports/service";
import { resetDb } from "./reset-db";

const { perIp, perAsset, windowMs } = ANONYMOUS_REPORT_LIMITS;

let sequence = 0;

async function newAsset() {
  const n = ++sequence;
  const location = await db.location.create({
    data: { building: "Edificio B", room: `Lab ${n}` },
  });

  return db.asset.create({
    data: {
      publicCode: generatePublicCode(),
      inventoryNumber: `LIM-${n}`,
      name: `Equipo ${n}`,
      type: "PROJECTOR",
      locationId: location.id,
    },
    select: { id: true, publicCode: true },
  });
}

function report(
  publicCode: string,
  reporterIpHash: string | null,
  viewer: Viewer = null,
) {
  return createReport(
    viewer,
    publicCode,
    { description: "No proyecta" },
    { reporterIpHash },
  );
}

async function reportMany(
  publicCode: string,
  count: number,
  ipOf: (i: number) => string | null,
) {
  for (let i = 0; i < count; i++) {
    const result = await report(publicCode, ipOf(i));

    if (!result.ok) throw new Error("No se pudo crear el reporte de prueba.");
  }
}

async function expectLimit(
  promise: Promise<unknown>,
  limit: ReportRateLimitError["limit"],
) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(ReportRateLimitError);
  expect(error).toMatchObject({ limit });
}

let asset: Awaited<ReturnType<typeof newAsset>>;

beforeEach(async () => {
  await resetDb();
  asset = await newAsset();
});

afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("límite por IP", () => {
  it(`rechaza el reporte ${perIp + 1} de la misma IP sin crear nada`, async () => {
    const assets = [asset, await newAsset(), await newAsset()];

    for (let i = 0; i < perIp; i++) {
      await reportMany(assets[i % assets.length].publicCode, 1, () => "ip-a");
    }

    const fresh = await newAsset();
    await expectLimit(report(fresh.publicCode, "ip-a"), "ip");

    await expect(db.report.count()).resolves.toBe(perIp);
    await expect(
      db.asset.findUniqueOrThrow({ where: { id: fresh.id } }),
    ).resolves.toMatchObject({ status: "OPERATIONAL" });
  });

  it("el mensaje explica qué pasó y qué hacer", async () => {
    const error = new ReportRateLimitError("ip");

    expect(error.message).toMatch(/desde esta red/);
    expect(error.message).toMatch(/Inténtalo más tarde/);
  });

  it("otra IP no se ve afectada", async () => {
    const assets = [asset, await newAsset(), await newAsset()];

    for (let i = 0; i < perIp; i++) {
      await reportMany(assets[i % assets.length].publicCode, 1, () => "ip-a");
    }

    const fresh = await newAsset();
    await expect(report(fresh.publicCode, "ip-b")).resolves.toMatchObject({
      ok: true,
    });
  });
});

describe("límite por activo", () => {
  it(`rechaza el reporte ${perAsset + 1} del mismo activo aunque cambie la IP`, async () => {
    await reportMany(asset.publicCode, perAsset, (i) => `ip-${i}`);

    await expectLimit(report(asset.publicCode, "ip-nueva"), "asset");
    await expect(db.report.count()).resolves.toBe(perAsset);
  });

  it("aplica también si no se conoce la IP", async () => {
    await reportMany(asset.publicCode, perAsset, () => null);

    await expectLimit(report(asset.publicCode, null), "asset");
  });

  it("cuenta los reportes del personal", async () => {
    const staff = await db.user.create({
      data: { name: "Staff", email: "staff@test.mx", role: "STAFF" },
    });
    const viewer: Viewer = { id: staff.id, role: "STAFF", isActive: true };

    for (let i = 0; i < perAsset; i++) {
      await report(asset.publicCode, null, viewer);
    }

    await expectLimit(report(asset.publicCode, "ip-a"), "asset");
  });

  it("los reportes fuera de la ventana de tiempo ya no cuentan", async () => {
    await reportMany(asset.publicCode, perAsset, () => "ip-a");
    await db.report.updateMany({
      data: { createdAt: new Date(Date.now() - windowMs - 1000) },
    });

    await expect(report(asset.publicCode, "ip-a")).resolves.toMatchObject({
      ok: true,
    });
  });
});

describe("usuarios con sesión", () => {
  it("no tienen límite y no se guarda su IP", async () => {
    const admin = await db.user.create({
      data: { name: "Admin", email: "admin@test.mx", role: "ADMIN" },
    });
    const viewer: Viewer = { id: admin.id, role: "ADMIN", isActive: true };

    await reportMany(asset.publicCode, perAsset, () => "ip-a");
    const result = await report(asset.publicCode, "ip-a", viewer);

    expect(result.ok).toBe(true);
    const created = await db.report.findUniqueOrThrow({
      where: { id: (result as { data: { id: string } }).data.id },
    });
    expect(created.reporterIpHash).toBeNull();
  });

  it("un usuario inactivo se trata como anónimo", async () => {
    const viewer: Viewer = { id: "inactivo", role: "ADMIN", isActive: false };

    await reportMany(asset.publicCode, perAsset, () => "ip-a");

    await expectLimit(report(asset.publicCode, "ip-b", viewer), "asset");
  });
});

describe("envíos simultáneos", () => {
  it("del mismo activo no superan el tope", async () => {
    const attempts = perAsset + 3;

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, (_, i) =>
        report(asset.publicCode, `ip-${i}`),
      ),
    );

    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(attempts - perAsset);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(ReportRateLimitError);
    }
    await expect(db.report.count()).resolves.toBe(perAsset);
  });

  it("de la misma IP no superan el tope", async () => {
    const assets = [asset, await newAsset(), await newAsset()];
    const attempts = perIp + 4;

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, (_, i) =>
        report(assets[i % assets.length].publicCode, "ip-a"),
      ),
    );

    expect(results.filter((r) => r.status === "rejected")).toHaveLength(
      attempts - perIp,
    );
    await expect(db.report.count()).resolves.toBe(perIp);
  });
});
