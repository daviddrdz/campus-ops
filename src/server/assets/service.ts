import type { AssetWhereInput } from "@/generated/prisma/models";
import {
  fieldErrorsFrom,
  type FieldErrors,
  type ServiceResult,
} from "@/lib/form-state";
import { generatePublicCode } from "@/lib/public-code";
import {
  assetInputSchema,
  assetSearchSchema,
  recordIdSchema,
  type AssetField,
} from "@/lib/validators/assets";
import { assertCan } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { isRecordNotFound, violatedConstraint } from "@/server/prisma-errors";

const MAX_PUBLIC_CODE_ATTEMPTS = 5;

type SavedAsset = { id: string; publicCode: string };
type AssetResult = ServiceResult<SavedAsset, AssetField>;

const savedAssetSelect = { id: true, publicCode: true } as const;

function buildSearchFilter(query: string): AssetWhereInput {
  const terms = query.split(/\s+/).filter(Boolean);

  return {
    AND: terms.map((term) => {
      // Prisma no escapa los comodines de LIKE en `contains`.
      const contains = term.replace(/[\\%_]/g, "\\$&");
      const match = { contains, mode: "insensitive" as const };

      return {
        OR: [
          { inventoryNumber: match },
          { name: match },
          { brand: match },
          { model: match },
          { serialNumber: match },
          { location: { building: match } },
          { location: { room: match } },
        ],
      };
    }),
  };
}

function constraintFieldErrors(error: unknown): FieldErrors<AssetField> | null {
  const unique = violatedConstraint(error, "P2002");

  if (unique === "Asset_inventoryNumber_key") {
    return { inventoryNumber: "Ya existe un activo con este número." };
  }

  if (unique === "Asset_serialNumber_key") {
    return { serialNumber: "Ya existe un activo con esta serie." };
  }

  if (violatedConstraint(error, "P2003") === "Asset_locationId_fkey") {
    return { locationId: "Esa ubicación ya no existe. Elige otra." };
  }

  return null;
}

export async function listAssets(viewer: Viewer, rawQuery?: unknown) {
  assertCan(viewer, "asset:manage");
  const query = assetSearchSchema.parse(rawQuery ?? "");

  return db.asset.findMany({
    where: buildSearchFilter(query),
    orderBy: { inventoryNumber: "asc" },
    select: {
      id: true,
      inventoryNumber: true,
      name: true,
      type: true,
      brand: true,
      model: true,
      status: true,
      location: { select: { building: true, room: true } },
    },
  });
}

export async function getAsset(viewer: Viewer, rawId: unknown) {
  assertCan(viewer, "asset:manage");
  const id = recordIdSchema.safeParse(rawId);

  if (!id.success) {
    return null;
  }

  return db.asset.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      publicCode: true,
      inventoryNumber: true,
      name: true,
      type: true,
      brand: true,
      model: true,
      serialNumber: true,
      specifications: true,
      status: true,
      locationId: true,
    },
  });
}

export async function createAsset(
  viewer: Viewer,
  rawInput: unknown,
): Promise<AssetResult> {
  assertCan(viewer, "asset:manage");
  const input = assetInputSchema.safeParse(rawInput);

  if (!input.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(input.error) };
  }

  for (let attempt = 0; attempt < MAX_PUBLIC_CODE_ATTEMPTS; attempt++) {
    try {
      const asset = await db.asset.create({
        data: { ...input.data, publicCode: generatePublicCode() },
        select: savedAssetSelect,
      });

      return { ok: true, data: asset };
    } catch (error) {
      if (violatedConstraint(error, "P2002") === "Asset_publicCode_key") {
        continue;
      }

      const fieldErrors = constraintFieldErrors(error);

      if (fieldErrors) {
        return { ok: false, fieldErrors };
      }

      throw error;
    }
  }

  throw new Error("No se pudo generar un código público único.");
}

export async function updateAsset(
  viewer: Viewer,
  rawId: unknown,
  rawInput: unknown,
): Promise<AssetResult> {
  assertCan(viewer, "asset:manage");
  const id = recordIdSchema.safeParse(rawId);

  if (!id.success) {
    return { ok: false, message: "Este activo ya no existe." };
  }

  const input = assetInputSchema.safeParse(rawInput);

  if (!input.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(input.error) };
  }

  try {
    // input.data no incluye publicCode ni status: ninguno se edita aquí.
    const asset = await db.asset.update({
      where: { id: id.data },
      data: input.data,
      select: savedAssetSelect,
    });

    return { ok: true, data: asset };
  } catch (error) {
    if (isRecordNotFound(error)) {
      return { ok: false, message: "Este activo ya no existe." };
    }

    const fieldErrors = constraintFieldErrors(error);

    if (fieldErrors) {
      return { ok: false, fieldErrors };
    }

    throw error;
  }
}
