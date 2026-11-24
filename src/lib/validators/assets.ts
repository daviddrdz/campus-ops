import { z } from "zod";
import { AssetType } from "@/generated/prisma/enums";

export const ASSET_LIMITS = {
  inventoryNumber: 50,
  name: 120,
  brand: 80,
  model: 80,
  serialNumber: 80,
  specifications: 1000,
  building: 120,
  room: 120,
  search: 100,
} as const;

function requiredText(label: string, max: number) {
  return z
    .string({ error: `Escribe ${label}.` })
    .trim()
    .min(1, `Escribe ${label}.`)
    .max(max, `Usa máximo ${max} caracteres.`);
}

function optionalText(max: number) {
  return z
    .string({ error: "El valor no es válido." })
    .trim()
    .max(max, `Usa máximo ${max} caracteres.`)
    .nullish()
    .transform((value) => value || null);
}

export const recordIdSchema = z.string().min(1).max(64);

export const assetInputSchema = z.object({
  inventoryNumber: requiredText(
    "el número de inventario",
    ASSET_LIMITS.inventoryNumber,
  ),
  name: requiredText("el nombre del equipo", ASSET_LIMITS.name),
  type: z.enum(AssetType, { error: "Elige el tipo de equipo." }),
  brand: optionalText(ASSET_LIMITS.brand),
  model: optionalText(ASSET_LIMITS.model),
  serialNumber: optionalText(ASSET_LIMITS.serialNumber),
  specifications: optionalText(ASSET_LIMITS.specifications),
  locationId: z
    .string({ error: "Elige una ubicación." })
    .min(1, "Elige una ubicación.")
    .max(64, "Elige una ubicación."),
});

export const locationInputSchema = z.object({
  building: requiredText("el edificio", ASSET_LIMITS.building),
  room: requiredText("el aula o laboratorio", ASSET_LIMITS.room),
});

export const assetSearchSchema = z
  .string()
  .trim()
  .max(ASSET_LIMITS.search)
  .catch("");

export type AssetField = keyof z.input<typeof assetInputSchema>;
export type LocationField = keyof z.input<typeof locationInputSchema>;
