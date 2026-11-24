import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { createAssetAction, updateAssetAction } from "@/server/assets/actions";
import { db } from "@/server/db";
import {
  createLocationAction,
  updateLocationAction,
} from "@/server/locations/actions";
import { resetDb } from "./reset-db";

const session = vi.hoisted(() => ({
  user: null as null | { id: string; role: string; isActive: boolean },
}));

vi.mock("@/server/auth/session", () => ({
  requireUser: async () => {
    if (!session.user) {
      throw new Error("REDIRECT:/login");
    }

    return session.user;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const idle = { ok: false };

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

function signInAs(role: UserRole) {
  session.user = { id: `usuario-${role}`, role, isActive: true };
}

async function seedAsset() {
  const location = await db.location.create({
    data: { building: "Edificio A", room: "Aula 1" },
  });
  const asset = await db.asset.create({
    data: {
      publicCode: "codigoprueba",
      inventoryNumber: "INV-1",
      name: "Original",
      type: "COMPUTER",
      locationId: location.id,
    },
  });

  return { location, asset };
}

const assetValues = (locationId: string) => ({
  inventoryNumber: "INV-2",
  name: "Cambiado",
  type: "DISPLAY",
  locationId,
});

describe("acciones de activos y ubicaciones", () => {
  beforeEach(async () => {
    await resetDb();
    session.user = null;
  });
  afterAll(() => db.$disconnect());

  it.each<UserRole>(["STAFF", "TECHNICIAN"])(
    "%s no puede ejecutar ninguna acción",
    async (role) => {
      const { location, asset } = await seedAsset();
      signInAs(role);
      const locationValues = formData({ building: "Nuevo", room: "Nuevo" });

      const results = await Promise.all([
        createAssetAction(idle, formData(assetValues(location.id))),
        updateAssetAction(asset.id, idle, formData(assetValues(location.id))),
        createLocationAction(idle, locationValues),
        updateLocationAction(location.id, idle, locationValues),
      ]);

      for (const result of results) {
        expect(result).toMatchObject({
          ok: false,
          message: expect.stringContaining("No tienes permiso"),
        });
      }
      await expect(db.asset.count()).resolves.toBe(1);
      await expect(db.location.count()).resolves.toBe(1);
      await expect(
        db.asset.findUniqueOrThrow({ where: { id: asset.id } }),
      ).resolves.toMatchObject({ name: "Original" });
    },
  );

  it("sin sesión, cada acción redirige a /login", async () => {
    const { location, asset } = await seedAsset();
    const values = formData(assetValues(location.id));

    await expect(createAssetAction(idle, values)).rejects.toThrow(
      "REDIRECT:/login",
    );
    await expect(updateAssetAction(asset.id, idle, values)).rejects.toThrow(
      "REDIRECT:/login",
    );
    await expect(createLocationAction(idle, values)).rejects.toThrow(
      "REDIRECT:/login",
    );
    await expect(
      updateLocationAction(location.id, idle, values),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("el ADMIN crea un activo desde el formulario y vuelve a la lista", async () => {
    const { location } = await seedAsset();
    signInAs("ADMIN");

    await expect(
      createAssetAction(idle, formData(assetValues(location.id))),
    ).rejects.toThrow("REDIRECT:/activos?aviso=creado");
    await expect(
      db.asset.findUniqueOrThrow({ where: { inventoryNumber: "INV-2" } }),
    ).resolves.toMatchObject({ name: "Cambiado", type: "DISPLAY" });
  });

  it("el ADMIN edita un activo sin cambiar su publicCode", async () => {
    const { location, asset } = await seedAsset();
    signInAs("ADMIN");
    const values = formData({
      ...assetValues(location.id),
      publicCode: "manipulado",
    });

    await expect(updateAssetAction(asset.id, idle, values)).rejects.toThrow(
      "REDIRECT:/activos?aviso=actualizado",
    );
    await expect(
      db.asset.findUniqueOrThrow({ where: { id: asset.id } }),
    ).resolves.toMatchObject({ name: "Cambiado", publicCode: "codigoprueba" });
  });

  it("devuelve los errores de campo al formulario", async () => {
    const { location } = await seedAsset();
    signInAs("ADMIN");

    await expect(
      createAssetAction(
        idle,
        formData({ ...assetValues(location.id), name: " " }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      fieldErrors: { name: "Escribe el nombre del equipo." },
    });
  });

  it("el ADMIN crea y edita ubicaciones", async () => {
    signInAs("ADMIN");

    await expect(
      createLocationAction(
        idle,
        formData({ building: "Edificio C", room: "Aula 3" }),
      ),
    ).resolves.toEqual({ ok: true });
    const location = await db.location.findFirstOrThrow();

    await expect(
      updateLocationAction(
        location.id,
        idle,
        formData({ building: "Edificio C", room: "Aula 4" }),
      ),
    ).resolves.toEqual({ ok: true });
    await expect(
      db.location.findUniqueOrThrow({ where: { id: location.id } }),
    ).resolves.toMatchObject({ room: "Aula 4" });
  });
});
