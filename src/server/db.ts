import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Falta la variable de entorno DATABASE_URL.");
  }

  const adapter = new PrismaPg({
    connectionString,
    // En Prisma 7 el valor por defecto es 0: esperaría indefinidamente.
    connectionTimeoutMillis: 5_000,
  });

  return new PrismaClient({ adapter });
}

// Evita abrir un pool nuevo en cada recarga de `next dev`.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
