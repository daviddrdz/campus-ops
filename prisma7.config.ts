import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Sin env(): `prisma generate` debe funcionar en una instalación sin .env.
    // Las migraciones van por la conexión directa: el pooler de Neon (PgBouncer en
    // modo transacción) no sirve para `migrate`. En local no hay pooler.
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
