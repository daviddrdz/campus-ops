import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { generatePublicCode } from "@/lib/public-code";
import { db } from "@/server/db";
import { resetDb } from "./reset-db";

let inventorySequence = 0;

async function createLocation() {
  return db.location.create({
    data: {
      building: "Edificio de prueba",
      room: `Aula ${++inventorySequence}`,
    },
  });
}

async function createAsset(overrides: { publicCode?: string } = {}) {
  const location = await createLocation();

  return db.asset.create({
    data: {
      publicCode: overrides.publicCode ?? generatePublicCode(),
      inventoryNumber: `TEST-${++inventorySequence}`,
      name: "Equipo de prueba",
      type: "COMPUTER",
      locationId: location.id,
    },
  });
}

describe("esquema de la base de datos", () => {
  beforeEach(resetDb);
  afterAll(() => db.$disconnect());

  it("se conecta a la base de pruebas", async () => {
    const [{ current_database: database }] = await db.$queryRaw<
      { current_database: string }[]
    >`SELECT current_database()`;

    expect(database).toBe("campusops_test");
  });

  it("rechaza un publicCode repetido", async () => {
    await createAsset({ publicCode: "codigorepetido" });

    await expect(
      createAsset({ publicCode: "codigorepetido" }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("exige una ubicación existente para el activo", async () => {
    await expect(
      db.asset.create({
        data: {
          publicCode: generatePublicCode(),
          inventoryNumber: "TEST-SIN-UBICACION",
          name: "Equipo sin ubicación",
          type: "COMPUTER",
          locationId: "ubicacion-inexistente",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("no permite borrar un activo con reportes", async () => {
    const asset = await createAsset();
    await db.report.create({
      data: { assetId: asset.id, description: "No enciende" },
    });

    await expect(
      db.asset.delete({ where: { id: asset.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(db.asset.count()).resolves.toBe(1);
  });

  it("crea reportes con folio consecutivo, prioridad media y estado reportado", async () => {
    const asset = await createAsset();
    const first = await db.report.create({
      data: { assetId: asset.id, description: "Primera falla" },
    });
    const second = await db.report.create({
      data: { assetId: asset.id, description: "Segunda falla" },
    });

    expect(second.folio).toBe(first.folio + 1);
    expect(first.priority).toBe("MEDIUM");
    expect(first.status).toBe("REPORTED");
  });

  it("permite varios reportes abiertos para el mismo activo", async () => {
    const asset = await createAsset();
    await db.report.createMany({
      data: [
        { assetId: asset.id, description: "Falla de video" },
        { assetId: asset.id, description: "Falla de audio" },
      ],
    });

    await expect(
      db.report.count({ where: { assetId: asset.id, status: "REPORTED" } }),
    ).resolves.toBe(2);
  });

  it("ordena los eventos de un reporte por fecha", async () => {
    const asset = await createAsset();
    const report = await db.report.create({
      data: { assetId: asset.id, description: "Falla" },
    });
    await db.reportEvent.createMany({
      data: [
        {
          reportId: report.id,
          type: "STATUS_CHANGED",
          createdAt: new Date("2026-01-03T10:00:00Z"),
        },
        {
          reportId: report.id,
          type: "CREATED",
          createdAt: new Date("2026-01-01T10:00:00Z"),
        },
        {
          reportId: report.id,
          type: "ASSIGNED",
          createdAt: new Date("2026-01-02T10:00:00Z"),
        },
      ],
    });

    const { events } = await db.report.findUniqueOrThrow({
      where: { id: report.id },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });

    expect(events.map((event) => event.type)).toEqual([
      "CREATED",
      "ASSIGNED",
      "STATUS_CHANGED",
    ]);
  });
});
