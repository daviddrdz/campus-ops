import { fieldErrorsFrom, type ServiceResult } from "@/lib/form-state";
import {
  locationInputSchema,
  recordIdSchema,
  type LocationField,
} from "@/lib/validators/assets";
import { assertCan } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { isRecordNotFound, violatedConstraint } from "@/server/prisma-errors";

type LocationResult = ServiceResult<{ id: string }, LocationField>;

const DUPLICATE_LOCATION: LocationResult = {
  ok: false,
  fieldErrors: { room: "Esta aula ya está registrada en ese edificio." },
};

function isDuplicateLocation(error: unknown) {
  return violatedConstraint(error, "P2002") === "Location_building_room_key";
}

export async function listLocations(viewer: Viewer) {
  assertCan(viewer, "asset:manage");

  return db.location.findMany({
    orderBy: [{ building: "asc" }, { room: "asc" }],
    select: {
      id: true,
      building: true,
      room: true,
      _count: { select: { assets: true } },
    },
  });
}

export async function createLocation(
  viewer: Viewer,
  rawInput: unknown,
): Promise<LocationResult> {
  assertCan(viewer, "asset:manage");
  const input = locationInputSchema.safeParse(rawInput);

  if (!input.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(input.error) };
  }

  try {
    const location = await db.location.create({
      data: input.data,
      select: { id: true },
    });

    return { ok: true, data: location };
  } catch (error) {
    if (isDuplicateLocation(error)) {
      return DUPLICATE_LOCATION;
    }

    throw error;
  }
}

export async function updateLocation(
  viewer: Viewer,
  rawId: unknown,
  rawInput: unknown,
): Promise<LocationResult> {
  assertCan(viewer, "asset:manage");
  const id = recordIdSchema.safeParse(rawId);

  if (!id.success) {
    return { ok: false, message: "Esta ubicación ya no existe." };
  }

  const input = locationInputSchema.safeParse(rawInput);

  if (!input.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(input.error) };
  }

  try {
    const location = await db.location.update({
      where: { id: id.data },
      data: input.data,
      select: { id: true },
    });

    return { ok: true, data: location };
  } catch (error) {
    if (isRecordNotFound(error)) {
      return { ok: false, message: "Esta ubicación ya no existe." };
    }

    if (isDuplicateLocation(error)) {
      return DUPLICATE_LOCATION;
    }

    throw error;
  }
}
