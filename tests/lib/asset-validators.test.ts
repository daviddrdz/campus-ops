import { describe, expect, it } from "vitest";
import { AssetType } from "@/generated/prisma/enums";
import {
  ASSET_LIMITS,
  assetInputSchema,
  assetSearchSchema,
  locationInputSchema,
} from "@/lib/validators/assets";

const validAsset = {
  inventoryNumber: "INV-0100",
  name: "PC de prueba",
  type: "COMPUTER",
  locationId: "ubicacion-1",
};

function errorFields(schema: typeof assetInputSchema, input: unknown) {
  const result = schema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path[0]);
}

describe("assetInputSchema", () => {
  it("acepta solo los campos obligatorios y deja los opcionales en null", () => {
    expect(assetInputSchema.parse(validAsset)).toEqual({
      ...validAsset,
      brand: null,
      model: null,
      serialNumber: null,
      specifications: null,
    });
  });

  it.each(["inventoryNumber", "name", "type", "locationId"])(
    "exige %s",
    (field) => {
      const input: Record<string, unknown> = { ...validAsset };
      delete input[field];

      expect(errorFields(assetInputSchema, input)).toContain(field);
    },
  );

  it.each(["inventoryNumber", "name"])(
    "rechaza %s con solo espacios",
    (field) => {
      expect(
        errorFields(assetInputSchema, { ...validAsset, [field]: "   " }),
      ).toContain(field);
    },
  );

  it("recorta espacios y convierte opcionales vacíos en null", () => {
    const parsed = assetInputSchema.parse({
      ...validAsset,
      name: "  PC de prueba  ",
      brand: "   ",
      serialNumber: "",
    });

    expect(parsed.name).toBe("PC de prueba");
    expect(parsed.brand).toBeNull();
    expect(parsed.serialNumber).toBeNull();
  });

  it.each(Object.values(AssetType))("acepta el tipo %s", (type) => {
    expect(assetInputSchema.safeParse({ ...validAsset, type }).success).toBe(
      true,
    );
  });

  it("rechaza un tipo de activo inválido", () => {
    expect(
      errorFields(assetInputSchema, { ...validAsset, type: "IMPRESORA" }),
    ).toContain("type");
  });

  it.each([
    ["inventoryNumber", ASSET_LIMITS.inventoryNumber],
    ["name", ASSET_LIMITS.name],
    ["brand", ASSET_LIMITS.brand],
    ["model", ASSET_LIMITS.model],
    ["serialNumber", ASSET_LIMITS.serialNumber],
    ["specifications", ASSET_LIMITS.specifications],
  ] as const)("limita la longitud de %s", (field, max) => {
    expect(
      assetInputSchema.safeParse({ ...validAsset, [field]: "a".repeat(max) })
        .success,
    ).toBe(true);
    expect(
      errorFields(assetInputSchema, {
        ...validAsset,
        [field]: "a".repeat(max + 1),
      }),
    ).toContain(field);
  });

  it("descarta publicCode y status aunque vengan en la entrada", () => {
    const parsed = assetInputSchema.parse({
      ...validAsset,
      publicCode: "codigo-manipulado",
      status: "IN_MAINTENANCE",
    });

    expect(parsed).not.toHaveProperty("publicCode");
    expect(parsed).not.toHaveProperty("status");
  });
});

describe("locationInputSchema", () => {
  it("acepta edificio y aula, sin espacios sobrantes", () => {
    expect(
      locationInputSchema.parse({ building: " Edificio C ", room: " Aula 5 " }),
    ).toEqual({ building: "Edificio C", room: "Aula 5" });
  });

  it.each(["building", "room"] as const)("exige %s", (field) => {
    const result = locationInputSchema.safeParse({
      building: "Edificio C",
      room: "Aula 5",
      [field]: " ",
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["building", ASSET_LIMITS.building],
    ["room", ASSET_LIMITS.room],
  ] as const)("limita la longitud de %s", (field, max) => {
    const result = locationInputSchema.safeParse({
      building: "Edificio C",
      room: "Aula 5",
      [field]: "a".repeat(max + 1),
    });

    expect(result.success).toBe(false);
  });
});

describe("assetSearchSchema", () => {
  it("recorta la búsqueda", () => {
    expect(assetSearchSchema.parse("  proyector ")).toBe("proyector");
  });

  it.each([["a", "b"], 5, "a".repeat(ASSET_LIMITS.search + 1)])(
    "ignora una búsqueda inválida",
    (value) => {
      expect(assetSearchSchema.parse(value)).toBe("");
    },
  );
});
