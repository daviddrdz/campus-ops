import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Falta la variable de entorno DATABASE_URL.");
  }

  const pool = new Pool({
    connectionString,
    // En Prisma 7 el valor por defecto es 0: esperaría indefinidamente.
    connectionTimeoutMillis: 5_000,
  });

  // En Vercel (Fluid compute) cierra las conexiones inactivas antes de suspender
  // la instancia; si no, la primera consulta al despertar usa un socket muerto.
  // Fuera de Vercel no hace nada.
  attachDatabasePool(pool);

  return new PrismaClient({
    adapter: new PrismaPg(pool, { disposeExternalPool: true }),
  });
}

// Evita abrir un pool nuevo en cada recarga de `next dev`.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
