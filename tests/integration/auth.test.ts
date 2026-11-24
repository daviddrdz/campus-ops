import { hashPassword } from "better-auth/crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/server/auth/auth";
import {
  AuthorizationError,
  getSession,
  requireRole,
  requireUser,
} from "@/server/auth/session";
import { db } from "@/server/db";
import { resetDb } from "./reset-db";

const request = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: vi.fn(), set: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const BASE_URL = "http://localhost:3000";
const PASSWORD = "contrasena-de-prueba";

async function createUser(
  email: string,
  role: UserRole,
  options: { isActive?: boolean } = {},
) {
  const user = await db.user.create({
    data: {
      name: `Usuario ${role}`,
      email,
      role,
      emailVerified: true,
      isActive: options.isActive ?? true,
    },
  });
  await db.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(PASSWORD),
    },
  });

  return user;
}

function postAuth(path: string, body: unknown) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify(body),
    }),
  );
}

async function signIn(email: string, password = PASSWORD) {
  const response = await postAuth("/sign-in/email", { email, password });
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  return { response, cookie };
}

async function signInAs(email: string) {
  const { cookie } = await signIn(email);
  request.headers = new Headers({ cookie });
}

describe("autenticación", () => {
  beforeEach(async () => {
    await resetDb();
    request.headers = new Headers();
  });
  afterAll(() => db.$disconnect());

  it("inicia sesión con credenciales correctas", async () => {
    await createUser("admin@campusops.test", "ADMIN");

    await signInAs("admin@campusops.test");

    await expect(getSession()).resolves.toMatchObject({
      email: "admin@campusops.test",
      role: "ADMIN",
      isActive: true,
    });
  });

  it("rechaza una contraseña incorrecta", async () => {
    await createUser("admin@campusops.test", "ADMIN");

    const { response, cookie } = await signIn(
      "admin@campusops.test",
      "contrasena-incorrecta",
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_EMAIL_OR_PASSWORD",
    });
    expect(cookie).toBe("");
    await expect(db.session.count()).resolves.toBe(0);
  });

  it("responde igual si el correo no existe", async () => {
    const { response } = await signIn("nadie@campusops.test");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_EMAIL_OR_PASSWORD",
    });
  });

  it("el endpoint de registro rechaza solicitudes", async () => {
    const response = await postAuth("/sign-up/email", {
      name: "Intruso",
      email: "intruso@campusops.test",
      password: PASSWORD,
      role: "ADMIN",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
    });
    await expect(db.user.count()).resolves.toBe(0);
  });

  it("un usuario inactivo no puede iniciar sesión", async () => {
    await createUser("inactivo@campusops.test", "TECHNICIAN", {
      isActive: false,
    });

    const { response, cookie } = await signIn("inactivo@campusops.test");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "ACCOUNT_INACTIVE",
    });
    expect(cookie).toBe("");
    await expect(db.session.count()).resolves.toBe(0);
  });

  it("desactivar a un usuario invalida su sesión abierta", async () => {
    const user = await createUser("tecnico@campusops.test", "TECHNICIAN");
    await signInAs("tecnico@campusops.test");
    await expect(getSession()).resolves.not.toBeNull();

    await db.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    await expect(getSession()).resolves.toBeNull();
  });

  it("una cookie inventada no abre sesión", async () => {
    request.headers = new Headers({
      cookie: "better-auth.session_token=token-falso.firma-falsa",
    });

    await expect(getSession()).resolves.toBeNull();
  });

  describe("requireUser y requireRole", () => {
    it("requireUser redirige a /login sin sesión", async () => {
      await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    });

    it("requireRole redirige a /login sin sesión", async () => {
      await expect(requireRole("ADMIN")).rejects.toThrow("REDIRECT:/login");
    });

    it("requireRole devuelve al usuario con un rol permitido", async () => {
      await createUser("admin@campusops.test", "ADMIN");
      await signInAs("admin@campusops.test");

      await expect(requireRole("ADMIN")).resolves.toMatchObject({
        role: "ADMIN",
      });
    });

    it("requireRole lanza error con un rol no permitido", async () => {
      await createUser("staff@campusops.test", "STAFF");
      await signInAs("staff@campusops.test");

      await expect(requireRole("ADMIN", "TECHNICIAN")).rejects.toBeInstanceOf(
        AuthorizationError,
      );
    });
  });
});
