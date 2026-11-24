import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { seedDatabase } from "../../prisma/seed-data";
import { resetDb } from "./reset-db";

async function getAssetCodes() {
  const assets = await db.asset.findMany({
    select: { inventoryNumber: true, publicCode: true },
    orderBy: { inventoryNumber: "asc" },
  });

  return assets;
}

describe("seed", () => {
  beforeEach(resetDb);
  afterAll(() => db.$disconnect());

  it("crea los usuarios, ubicaciones y activos de ejemplo", async () => {
    await seedDatabase(db);

    await expect(db.user.count()).resolves.toBe(4);
    await expect(db.location.count()).resolves.toBe(4);
    await expect(db.asset.count()).resolves.toBe(6);
    await expect(db.user.count({ where: { role: "ADMIN" } })).resolves.toBe(1);
    await expect(
      db.user.count({ where: { role: "TECHNICIAN" } }),
    ).resolves.toBe(2);
    await expect(db.user.count({ where: { role: "STAFF" } })).resolves.toBe(1);
  });

  it("se puede correr dos veces sin duplicar ni cambiar los códigos QR", async () => {
    await seedDatabase(db);
    const codesAfterFirstRun = await getAssetCodes();

    await seedDatabase(db);

    await expect(db.user.count()).resolves.toBe(4);
    await expect(db.location.count()).resolves.toBe(4);
    await expect(db.asset.count()).resolves.toBe(6);
    await expect(getAssetCodes()).resolves.toEqual(codesAfterFirstRun);
  });

  it("conserva el estado derivado de un activo al repetirse", async () => {
    await seedDatabase(db);
    await db.asset.update({
      where: { inventoryNumber: "INV-0001" },
      data: { status: "IN_MAINTENANCE" },
    });

    await seedDatabase(db);

    const asset = await db.asset.findUniqueOrThrow({
      where: { inventoryNumber: "INV-0001" },
    });
    expect(asset.status).toBe("IN_MAINTENANCE");
  });
});
