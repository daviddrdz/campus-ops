import { describe, expect, it } from "vitest";
import { assertSafeTestDatabaseUrl } from "../helpers/test-database.mts";

const dev = "postgresql://user:pass@localhost:5432/campusops_dev";
const test = "postgresql://user:pass@localhost:5432/campusops_test";

describe("assertSafeTestDatabaseUrl", () => {
  it("acepta una base de pruebas distinta de la de desarrollo", () => {
    expect(assertSafeTestDatabaseUrl(test, dev)).toBe(test);
  });

  it("rechaza que falte la URL", () => {
    expect(() => assertSafeTestDatabaseUrl(undefined, dev)).toThrow(
      "Falta DATABASE_URL_TEST",
    );
  });

  it("rechaza la base de desarrollo", () => {
    expect(() => assertSafeTestDatabaseUrl(dev, dev)).toThrow("_test");
  });

  it("rechaza que ambas URL apunten a la misma base", () => {
    expect(() => assertSafeTestDatabaseUrl(test, test)).toThrow(
      "no puede apuntar",
    );
  });
});
