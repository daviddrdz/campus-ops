import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { loadTestDatabaseUrl } from "./tests/helpers/test-database.mts";

const testDatabaseUrl = loadTestDatabaseUrl();

const resolve = {
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: ["tests/integration/**"],
          setupFiles: ["./tests/setup.ts"],
          // Una prueba unitaria que intente usar la BD falla en lugar de tocar desarrollo.
          env: { DATABASE_URL: "postgresql://unit-tests@127.0.0.1:1/no_db" },
        },
      },
      {
        resolve,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["./tests/integration/global-setup.ts"],
          fileParallelism: false,
          env: {
            DATABASE_URL: testDatabaseUrl,
            APP_URL: "http://localhost:3000",
            BETTER_AUTH_SECRET: "secreto-solo-para-pruebas-de-integracion",
            IP_HASH_SECRET: "secreto-de-ip-solo-para-pruebas",
          },
        },
      },
    ],
  },
});
