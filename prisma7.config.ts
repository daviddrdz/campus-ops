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
    url: process.env["DATABASE_URL"],
  },
});
