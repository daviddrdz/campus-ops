import { describe, expect, it } from "vitest";
import {
  generatePublicCode,
  PUBLIC_CODE_ALPHABET,
  PUBLIC_CODE_LENGTH,
} from "@/lib/public-code";

describe("generatePublicCode", () => {
  it("tiene al menos 10 caracteres", () => {
    expect(PUBLIC_CODE_LENGTH).toBeGreaterThanOrEqual(10);
    expect(generatePublicCode()).toHaveLength(PUBLIC_CODE_LENGTH);
  });

  it("usa solo el alfabeto permitido", () => {
    const allowed = new Set(PUBLIC_CODE_ALPHABET);

    for (let index = 0; index < 1_000; index += 1) {
      expect([...generatePublicCode()].every((char) => allowed.has(char))).toBe(
        true,
      );
    }
  });

  it("excluye caracteres ambiguos", () => {
    expect(PUBLIC_CODE_ALPHABET).not.toMatch(/[01ilo]/);
  });

  it("no genera colisiones en 10 000 muestras", () => {
    const codes = new Set(
      Array.from({ length: 10_000 }, () => generatePublicCode()),
    );

    expect(codes.size).toBe(10_000);
  });
});
