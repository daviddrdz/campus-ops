import { describe, expect, it } from "vitest";
import { getClientIp, hashIp } from "@/server/client-ip";

const SECRET = "secreto-de-prueba-largo";

function headersWith(values: Record<string, string>) {
  return new Headers(values);
}

describe("getClientIp", () => {
  it("toma el primer salto de X-Forwarded-For", () => {
    expect(
      getClientIp(
        headersWith({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1, 10.0.0.2" }),
      ),
    ).toBe("203.0.113.7");
  });

  it("usa X-Real-IP si no hay X-Forwarded-For", () => {
    expect(getClientIp(headersWith({ "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4",
    );
  });

  it("normaliza IPv4 mapeada en IPv6 y las mayúsculas de IPv6", () => {
    expect(
      getClientIp(headersWith({ "x-forwarded-for": "::ffff:192.0.2.1" })),
    ).toBe("192.0.2.1");
    expect(getClientIp(headersWith({ "x-forwarded-for": "2001:DB8::1" }))).toBe(
      "2001:db8::1",
    );
  });

  it.each([
    ["sin encabezados", {}],
    ["con un valor que no es IP", { "x-forwarded-for": "no-soy-ip" }],
    ["con el primer salto vacío", { "x-forwarded-for": ", 203.0.113.7" }],
  ])("devuelve null %s", (_name, values) => {
    expect(getClientIp(headersWith(values))).toBeNull();
  });
});

describe("hashIp", () => {
  it("es estable para la misma IP y el mismo secreto", () => {
    expect(hashIp("203.0.113.7", SECRET)).toBe(hashIp("203.0.113.7", SECRET));
  });

  it("no contiene la IP y tiene forma de SHA-256 en hexadecimal", () => {
    const hash = hashIp("203.0.113.7", SECRET);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203");
  });

  it("cambia con otra IP o con otro secreto", () => {
    const hash = hashIp("203.0.113.7", SECRET);

    expect(hashIp("203.0.113.8", SECRET)).not.toBe(hash);
    expect(hashIp("203.0.113.7", `${SECRET}-otro`)).not.toBe(hash);
  });

  it.each([
    ["con el secreto vacío", ""],
    ["con un secreto corto", "corto"],
  ])("falla %s", (_name, secret) => {
    expect(() => hashIp("203.0.113.7", secret)).toThrow(/IP_HASH_SECRET/);
  });
});
