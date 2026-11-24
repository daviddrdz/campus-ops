import { z } from "zod";
import { AssetType } from "@/generated/prisma/enums";
import { optionalText, recordIdSchema, requiredText } from "./text";

export { recordIdSchema };

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
