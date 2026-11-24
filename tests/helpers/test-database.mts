import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

function getDatabaseName(url: string) {
  const parsed = URL.parse(url);

  if (!parsed) {
    throw new Error("DATABASE_URL_TEST no es una URL válida.");
  }

  return decodeURIComponent(parsed.pathname.slice(1));
}

export function assertSafeTestDatabaseUrl(
  testUrl: string | undefined,
  devUrl: string | undefined,
) {
  if (!testUrl) {
    throw new Error("Falta DATABASE_URL_TEST. Copia .env.example a .env.");
  }

  const testDatabase = getDatabaseName(testUrl);

  if (!testDatabase.endsWith("_test")) {
    throw new Error(
      `La base de pruebas debe terminar en _test; se recibió "${testDatabase}".`,
    );
  }

  if (devUrl && getDatabaseName(devUrl) === testDatabase) {
    throw new Error(
      "DATABASE_URL_TEST no puede apuntar a la base de desarrollo.",
    );
  }

  return testUrl;
}

export function loadTestDatabaseUrl() {
  const fileEnv = existsSync(".env") ? parse(readFileSync(".env")) : {};

  return assertSafeTestDatabaseUrl(
    process.env.DATABASE_URL_TEST ?? fileEnv.DATABASE_URL_TEST,
    fileEnv.DATABASE_URL,
  );
}
