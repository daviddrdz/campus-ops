import { describe, expect, it } from "vitest";
import { ACCOUNT_INACTIVE_CODE, getLoginErrorMessage } from "@/lib/auth-errors";
import { loginSchema } from "@/lib/validators/auth";

describe("loginSchema", () => {
  it("normaliza el correo", () => {
    const parsed = loginSchema.parse({
      email: "  Admin@CampusOps.TEST ",
      password: "secreta",
    });

    expect(parsed.email).toBe("admin@campusops.test");
  });

  it.each([
    ["correo inválido", { email: "no-es-correo", password: "secreta" }],
    ["contraseña vacía", { email: "a@campusops.test", password: "" }],
    [
      "contraseña demasiado larga",
      { email: "a@campusops.test", password: "x".repeat(129) },
    ],
  ])("rechaza %s", (_name, input) => {
    expect(loginSchema.safeParse(input).success).toBe(false);
  });
});

describe("getLoginErrorMessage", () => {
  it.each([
    [{ status: 429 }, "Demasiados intentos"],
    [{ status: 403, code: ACCOUNT_INACTIVE_CODE }, "desactivada"],
    [{ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" }, "incorrectos"],
    [{ status: 500 }, "No pudimos iniciar sesión"],
  ])("traduce %o", (error, expected) => {
    expect(getLoginErrorMessage(error)).toContain(expected);
  });
});
