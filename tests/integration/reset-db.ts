import { db } from "@/server/db";

export async function resetDb() {
  const [{ current_database: database }] = await db.$queryRaw<
    { current_database: string }[]
  >`SELECT current_database()`;

  if (!database.endsWith("_test")) {
    throw new Error(`resetDb se negó a limpiar la base "${database}".`);
  }

  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const names = tables
    .map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`)
    .join(", ");

  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`,
  );
}
