import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { generatePublicCode } from "@/lib/public-code";
import {
  createAsset,
  getAsset,
  listAssets,
  updateAsset,
} from "@/server/assets/service";
import { AuthorizationError } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import {
  createLocation,
  listLocations,
  updateLocation,
} from "@/server/locations/service";
import { resetDb } from "./reset-db";

vi.mock("@/lib/public-code", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/public-code")>();

  return {
    ...original,
    generatePublicCode: vi.fn(original.generatePublicCode),
  };
});

const viewerWith = (role: UserRole): Viewer => ({
  id: `usuario-${role}`,
  role,
  isActive: true,
});

const admin = viewerWith("ADMIN");
const deniedViewers: [string, Viewer][] = [
  ["anónimo", null],
  ["administrativo", viewerWith("STAFF")],
  ["técnico", viewerWith("TECHNICIAN")],
  ["admin inactivo", { id: "inactivo", role: "ADMIN", isActive: false }],
];

async function newLocation(room = "Aula 1", building = "Edificio A") {
  return db.location.create({ data: { building, room } });
}

function assetInput(locationId: string, overrides: object = {}) {
  return {
    inventoryNumber: "INV-1000",
    name: "PC de prueba",
    type: "COMPUTER",
    brand: "Dell",
    model: "OptiPlex",
    serialNumber: "SN-1000",
    specifications: "16 GB RAM",
    locationId,
    ...overrides,
  };
}

async function createdAsset(locationId: string, overrides: object = {}) {
  const result = await createAsset(admin, assetInput(locationId, overrides));

  if (!result.ok) {
    throw new Error("No se pudo crear el activo de prueba.");
  }

  return result.data;
}

describe("servicio de activos", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(generatePublicCode).mockClear();
  });
  afterAll(() => db.$disconnect());

  describe("crear", () => {
    it("genera un publicCode único y deja el activo funcionando", async () => {
      const location = await newLocation();

      const first = await createdAsset(location.id);
      const second = await createdAsset(location.id, {
        inventoryNumber: "INV-1001",
        serialNumber: "SN-1001",
      });

      expect(first.publicCode).toMatch(/^[2-9a-hjkmnp-z]{12}$/);
      expect(second.publicCode).not.toBe(first.publicCode);
      await expect(
        db.asset.findUniqueOrThrow({ where: { id: first.id } }),
      ).resolves.toMatchObject({ status: "OPERATIONAL", name: "PC de prueba" });
    });

    it("ignora un publicCode o status enviados por el cliente", async () => {
      const location = await newLocation();

      const { id, publicCode } = await createdAsset(location.id, {
        publicCode: "codigo-manipulado",
        status: "IN_MAINTENANCE",
      });

      expect(publicCode).not.toBe("codigo-manipulado");
      await expect(
        db.asset.findUniqueOrThrow({ where: { id } }),
      ).resolves.toMatchObject({ status: "OPERATIONAL" });
    });

    it("reintenta con otro código si hay colisión", async () => {
      const location = await newLocation();
      await createdAsset(location.id, {
        inventoryNumber: "INV-1",
        serialNumber: null,
      });
      const existing = await db.asset.findFirstOrThrow();
      vi.mocked(generatePublicCode)
        .mockReturnValueOnce(existing.publicCode)
        .mockReturnValueOnce("codigonuevo2");

      const result = await createAsset(admin, assetInput(location.id));

      expect(result).toMatchObject({
        ok: true,
        data: { publicCode: "codigonuevo2" },
      });
    });

    it("falla sin crear nada si todos los reintentos chocan", async () => {
      const location = await newLocation();
      await createdAsset(location.id, {
        inventoryNumber: "INV-1",
        serialNumber: null,
      });
      const existing = await db.asset.findFirstOrThrow();

      for (let attempt = 0; attempt < 5; attempt++) {
        vi.mocked(generatePublicCode).mockReturnValueOnce(existing.publicCode);
      }

      await expect(createAsset(admin, assetInput(location.id))).rejects.toThrow(
        "código público",
      );
      await expect(db.asset.count()).resolves.toBe(1);
    });

    it("informa un número de inventario repetido", async () => {
      const location = await newLocation();
      await createdAsset(location.id);

      const result = await createAsset(
        admin,
        assetInput(location.id, { serialNumber: "SN-OTRA" }),
      );

      expect(result).toEqual({
        ok: false,
        fieldErrors: {
          inventoryNumber: "Ya existe un activo con este número.",
        },
      });
    });

    it("informa una serie repetida", async () => {
      const location = await newLocation();
      await createdAsset(location.id);

      const result = await createAsset(
        admin,
        assetInput(location.id, { inventoryNumber: "INV-OTRO" }),
      );

      expect(result).toEqual({
        ok: false,
        fieldErrors: { serialNumber: "Ya existe un activo con esta serie." },
      });
    });

    it("permite varios activos sin número de serie", async () => {
      const location = await newLocation();

      await createdAsset(location.id, { serialNumber: "" });
      await createdAsset(location.id, {
        inventoryNumber: "INV-1001",
        serialNumber: "",
      });

      await expect(db.asset.count()).resolves.toBe(2);
    });

    it("informa una ubicación inexistente", async () => {
      const result = await createAsset(admin, assetInput("no-existe"));

      expect(result).toMatchObject({
        ok: false,
        fieldErrors: { locationId: expect.any(String) },
      });
    });

    it("devuelve errores de validación sin tocar la base", async () => {
      const location = await newLocation();

      const result = await createAsset(
        admin,
        assetInput(location.id, { name: "  ", type: "IMPRESORA" }),
      );

      expect(result).toMatchObject({
        ok: false,
        fieldErrors: {
          name: "Escribe el nombre del equipo.",
          type: "Elige el tipo de equipo.",
        },
      });
      await expect(db.asset.count()).resolves.toBe(0);
    });
  });

  describe("editar", () => {
    it("actualiza los datos sin cambiar publicCode ni status", async () => {
      const location = await newLocation();
      const other = await newLocation("Aula 2");
      const asset = await createdAsset(location.id);
      await db.asset.update({
        where: { id: asset.id },
        data: { status: "FAULT_REPORTED" },
      });

      const result = await updateAsset(
        admin,
        asset.id,
        assetInput(other.id, {
          name: "PC renombrada",
          publicCode: "codigo-manipulado",
          status: "OPERATIONAL",
        }),
      );

      expect(result).toEqual({
        ok: true,
        data: { id: asset.id, publicCode: asset.publicCode },
      });
      await expect(
        db.asset.findUniqueOrThrow({ where: { id: asset.id } }),
      ).resolves.toMatchObject({
        name: "PC renombrada",
        locationId: other.id,
        publicCode: asset.publicCode,
        status: "FAULT_REPORTED",
      });
    });

    it("permite guardar sin cambiar su propio inventario y serie", async () => {
      const location = await newLocation();
      const asset = await createdAsset(location.id);

      await expect(
        updateAsset(admin, asset.id, assetInput(location.id)),
      ).resolves.toMatchObject({ ok: true });
    });

    it("informa un inventario que ya usa otro activo", async () => {
      const location = await newLocation();
      await createdAsset(location.id);
      const second = await createdAsset(location.id, {
        inventoryNumber: "INV-2000",
        serialNumber: "SN-2000",
      });

      const result = await updateAsset(
        admin,
        second.id,
        assetInput(location.id, { serialNumber: "SN-2000" }),
      );

      expect(result).toMatchObject({
        ok: false,
        fieldErrors: { inventoryNumber: expect.any(String) },
      });
    });

    it("informa si el activo no existe", async () => {
      const location = await newLocation();

      await expect(
        updateAsset(admin, "no-existe", assetInput(location.id)),
      ).resolves.toEqual({ ok: false, message: "Este activo ya no existe." });
    });
  });

  describe("listar y ver", () => {
    async function seedSearchData() {
      const lab = await newLocation("Laboratorio de Redes", "Edificio B");
      const library = await newLocation("Sala de Consulta", "Biblioteca");
      await createdAsset(lab.id, {
        inventoryNumber: "INV-0002",
        name: "Router principal",
        type: "OTHER",
        brand: "Cisco",
        model: "ISR 1100",
        serialNumber: "SN-CISCO",
      });
      await createdAsset(library.id, {
        inventoryNumber: "INV-0001",
        name: "PC de consulta",
        brand: "Lenovo",
        model: "ThinkCentre",
        serialNumber: "SN-LENOVO",
      });
    }

    const names = async (query?: unknown) =>
      (await listAssets(admin, query)).map(({ name }) => name);

    it("ordena por número de inventario", async () => {
      await seedSearchData();

      await expect(names()).resolves.toEqual([
        "PC de consulta",
        "Router principal",
      ]);
    });

    it.each([
      ["nombre", "router", "Router principal"],
      ["inventario", "inv-0001", "PC de consulta"],
      ["marca", "LENOVO", "PC de consulta"],
      ["modelo", "isr", "Router principal"],
      ["serie", "sn-cisco", "Router principal"],
      ["edificio", "biblioteca", "PC de consulta"],
      ["aula", "redes", "Router principal"],
      ["varias palabras", "cisco redes", "Router principal"],
    ])("filtra por %s", async (_field, query, expected) => {
      await seedSearchData();

      await expect(names(query)).resolves.toEqual([expected]);
    });

    it("exige que coincidan todas las palabras", async () => {
      await seedSearchData();

      await expect(names("cisco biblioteca")).resolves.toEqual([]);
    });

    it("devuelve todo con una búsqueda vacía", async () => {
      await seedSearchData();

      await expect(names("   ")).resolves.toHaveLength(2);
    });

    it("trata los comodines de SQL como texto", async () => {
      await seedSearchData();

      await expect(names("%")).resolves.toEqual([]);
    });

    it("devuelve null si el activo no existe", async () => {
      await expect(getAsset(admin, "no-existe")).resolves.toBeNull();
    });
  });

  describe.each(deniedViewers)("sin permiso: %s", (_label, viewer) => {
    it("no puede crear", async () => {
      const location = await newLocation();

      await expect(
        createAsset(viewer, assetInput(location.id)),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(db.asset.count()).resolves.toBe(0);
    });

    it("no puede editar", async () => {
      const location = await newLocation();
      const asset = await createdAsset(location.id);

      await expect(
        updateAsset(
          viewer,
          asset.id,
          assetInput(location.id, { name: "Intruso" }),
        ),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(
        db.asset.findUniqueOrThrow({ where: { id: asset.id } }),
      ).resolves.toMatchObject({ name: "PC de prueba" });
    });

    it("no puede listar ni ver el inventario administrativo", async () => {
      const location = await newLocation();
      const asset = await createdAsset(location.id);

      await expect(listAssets(viewer)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      await expect(getAsset(viewer, asset.id)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
    });

    it("no puede administrar ubicaciones", async () => {
      const location = await newLocation();

      await expect(listLocations(viewer)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      await expect(
        createLocation(viewer, { building: "X", room: "Y" }),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(
        updateLocation(viewer, location.id, { building: "X", room: "Y" }),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(db.location.count()).resolves.toBe(1);
    });
  });
});

describe("servicio de ubicaciones", () => {
  beforeEach(resetDb);

  it("crea una ubicación y la lista con su número de activos", async () => {
    const created = await createLocation(admin, {
      building: " Edificio C ",
      room: " Aula 7 ",
    });
    expect(created.ok).toBe(true);

    const [location] = await listLocations(admin);
    await createdAsset(location.id);

    await expect(listLocations(admin)).resolves.toMatchObject([
      { building: "Edificio C", room: "Aula 7", _count: { assets: 1 } },
    ]);
  });

  it("ordena por edificio y aula", async () => {
    await newLocation("Aula 2", "Edificio B");
    await newLocation("Aula 1", "Edificio B");
    await newLocation("Aula 9", "Edificio A");

    const locations = await listLocations(admin);

    expect(
      locations.map(({ building, room }) => `${building}/${room}`),
    ).toEqual(["Edificio A/Aula 9", "Edificio B/Aula 1", "Edificio B/Aula 2"]);
  });

  it("rechaza una ubicación repetida al crear", async () => {
    await newLocation("Aula 1", "Edificio A");

    await expect(
      createLocation(admin, { building: "Edificio A", room: "Aula 1" }),
    ).resolves.toMatchObject({
      ok: false,
      fieldErrors: { room: expect.any(String) },
    });
  });

  it("edita una ubicación", async () => {
    const location = await newLocation();

    await expect(
      updateLocation(admin, location.id, {
        building: "Edificio Z",
        room: "Aula 9",
      }),
    ).resolves.toEqual({ ok: true, data: { id: location.id } });
    await expect(
      db.location.findUniqueOrThrow({ where: { id: location.id } }),
    ).resolves.toMatchObject({ building: "Edificio Z", room: "Aula 9" });
  });

  it("rechaza editar hacia una ubicación que ya existe", async () => {
    await newLocation("Aula 1");
    const second = await newLocation("Aula 2");

    await expect(
      updateLocation(admin, second.id, {
        building: "Edificio A",
        room: "Aula 1",
      }),
    ).resolves.toMatchObject({
      ok: false,
      fieldErrors: { room: expect.any(String) },
    });
  });

  it("informa si la ubicación no existe", async () => {
    await expect(
      updateLocation(admin, "no-existe", { building: "A", room: "B" }),
    ).resolves.toEqual({ ok: false, message: "Esta ubicación ya no existe." });
  });
});
