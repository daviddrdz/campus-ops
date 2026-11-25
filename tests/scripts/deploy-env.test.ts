import { describe, expect, it } from "vitest";
import {
  DEV_SEED_PASSWORD,
  isLocalDatabaseUrl,
  planDeployMigration,
  resolveSeedPassword,
} from "../../scripts/deploy-env";

const LOCAL_DB = "postgresql://campusops:x@localhost:5432/campusops_dev";
const REMOTE_DB =
  "postgresql://user:x@ep-demo-123456.us-east-2.aws.neon.tech/neondb?sslmode=require";
const DEMO_PASSWORD = "una-contraseña-demo-larga";

describe("isLocalDatabaseUrl", () => {
  it.each([
    ["postgresql://u:p@localhost:5432/db", true],
    ["postgresql://u:p@127.0.0.1:5432/db", true],
    ["postgresql://u:p@[::1]:5432/db", true],
    [REMOTE_DB, false],
    ["no es una url", false],
    [undefined, false],
  ])("%s → %s", (url, expected) => {
    expect(isLocalDatabaseUrl(url)).toBe(expected);
  });
});

describe("resolveSeedPassword", () => {
  it("exige SEED_USER_PASSWORD", () => {
    expect(() => resolveSeedPassword({ DATABASE_URL: LOCAL_DB })).toThrow(
      /Falta SEED_USER_PASSWORD/,
    );
  });

  it("acepta la contraseña de desarrollo contra la BD local", () => {
    expect(
      resolveSeedPassword({
        DATABASE_URL: LOCAL_DB,
        SEED_USER_PASSWORD: DEV_SEED_PASSWORD,
      }),
    ).toBe(DEV_SEED_PASSWORD);
  });

  it.each([
    ["una BD remota", { DATABASE_URL: REMOTE_DB }],
    ["NODE_ENV=production", { DATABASE_URL: LOCAL_DB, NODE_ENV: "production" }],
    [
      "VERCEL_ENV=production",
      { DATABASE_URL: LOCAL_DB, VERCEL_ENV: "production" },
    ],
    ["sin DATABASE_URL", {}],
  ])("rechaza la contraseña de desarrollo con %s", (_case, env) => {
    expect(() =>
      resolveSeedPassword({ ...env, SEED_USER_PASSWORD: DEV_SEED_PASSWORD }),
    ).toThrow(/no puede ser la contraseña de desarrollo/);
  });

  it("rechaza una contraseña corta contra una BD remota", () => {
    expect(() =>
      resolveSeedPassword({
        DATABASE_URL: REMOTE_DB,
        SEED_USER_PASSWORD: "corta-11ch",
      }),
    ).toThrow(/al menos 12 caracteres/);
  });

  it("acepta una contraseña propia contra una BD remota", () => {
    expect(
      resolveSeedPassword({
        DATABASE_URL: REMOTE_DB,
        SEED_USER_PASSWORD: DEMO_PASSWORD,
      }),
    ).toBe(DEMO_PASSWORD);
  });
});

describe("planDeployMigration", () => {
  it.each([
    ["preview", { VERCEL_ENV: "preview", DATABASE_URL_UNPOOLED: REMOTE_DB }],
    ["development", { VERCEL_ENV: "development" }],
    ["fuera de Vercel", {}],
  ])("no migra en %s", (_case, env) => {
    expect(planDeployMigration(env)).toMatchObject({ migrate: false });
  });

  it("migra en producción con la conexión directa", () => {
    expect(
      planDeployMigration({
        VERCEL_ENV: "production",
        DATABASE_URL_UNPOOLED: REMOTE_DB,
      }),
    ).toEqual({ migrate: true });
  });

  it("falla en producción sin la conexión directa", () => {
    expect(() =>
      planDeployMigration({
        VERCEL_ENV: "production",
        DATABASE_URL: REMOTE_DB,
      }),
    ).toThrow(/Falta DATABASE_URL_UNPOOLED/);
  });
});
