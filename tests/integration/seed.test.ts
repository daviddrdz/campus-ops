import { verifyPassword } from "better-auth/crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { seedDatabase } from "../../prisma/seed-data";
import { resetDb } from "./reset-db";

const userPassword = "contrasena-de-seed";

async function getAssetCodes() {
  const assets = await db.asset.findMany({
    select: { inventoryNumber: true, publicCode: true },
    orderBy: { inventoryNumber: "asc" },
  });

  return assets;
}

// Cada corrida del seed hashea 4 contraseñas (scrypt); con toda la suite en
// paralelo, correrlo dos veces puede pasar de los 5 s por defecto.
describe("seed", { timeout: 20_000 }, () => {
  beforeEach(resetDb);
  afterAll(() => db.$disconnect());

  it("crea los usuarios, ubicaciones y activos de ejemplo", async () => {
    await seedDatabase(db, { userPassword });

    await expect(db.user.count()).resolves.toBe(4);
    await expect(db.location.count()).resolves.toBe(4);
    await expect(db.asset.count()).resolves.toBe(6);
    await expect(db.user.count({ where: { role: "ADMIN" } })).resolves.toBe(1);
    await expect(
      db.user.count({ where: { role: "TECHNICIAN" } }),
    ).resolves.toBe(2);
    await expect(db.user.count({ where: { role: "STAFF" } })).resolves.toBe(1);
  });

  it("crea una credencial con contraseña cifrada para cada usuario", async () => {
    await seedDatabase(db, { userPassword });

    const accounts = await db.account.findMany();

    expect(accounts).toHaveLength(4);
    for (const account of accounts) {
      expect(account.providerId).toBe("credential");
      expect(account.accountId).toBe(account.userId);
      expect(account.password).not.toBe(userPassword);
      await expect(
        verifyPassword({
          hash: account.password ?? "",
          password: userPassword,
        }),
      ).resolves.toBe(true);
    }
  });

  it("se puede correr dos veces sin duplicar ni cambiar los códigos QR", async () => {
    await seedDatabase(db, { userPassword });
    const codesAfterFirstRun = await getAssetCodes();

    await seedDatabase(db, { userPassword });

    await expect(db.user.count()).resolves.toBe(4);
    await expect(db.account.count()).resolves.toBe(4);
    await expect(db.location.count()).resolves.toBe(4);
    await expect(db.asset.count()).resolves.toBe(6);
    await expect(getAssetCodes()).resolves.toEqual(codesAfterFirstRun);
  });

  it("conserva el estado derivado de un activo al repetirse", async () => {
    await seedDatabase(db, { userPassword });
    await db.asset.update({
      where: { inventoryNumber: "INV-0001" },
      data: { status: "IN_MAINTENANCE" },
    });

    await seedDatabase(db, { userPassword });

    const asset = await db.asset.findUniqueOrThrow({
      where: { inventoryNumber: "INV-0001" },
    });
    expect(asset.status).toBe("IN_MAINTENANCE");
  });
});
