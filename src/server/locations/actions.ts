"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import type { LocationField } from "@/lib/validators/assets";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { createLocation, updateLocation } from "./service";

const FORBIDDEN = "No tienes permiso para administrar ubicaciones.";

export async function createLocationAction(
  _previous: FormState<LocationField>,
  formData: FormData,
): Promise<FormState<LocationField>> {
  const viewer = await requireUser();

  if (!can(viewer, "asset:manage")) {
    return { ok: false, message: FORBIDDEN };
  }

  const result = await createLocation(viewer, Object.fromEntries(formData));

  if (!result.ok) {
    return result;
  }

  revalidatePath("/ubicaciones");
  revalidatePath("/activos");

  return { ok: true };
}

export async function updateLocationAction(
  id: string,
  _previous: FormState<LocationField>,
  formData: FormData,
): Promise<FormState<LocationField>> {
  const viewer = await requireUser();

  if (!can(viewer, "asset:manage")) {
    return { ok: false, message: FORBIDDEN };
  }

  const result = await updateLocation(viewer, id, Object.fromEntries(formData));

  if (!result.ok) {
    return result;
  }

  revalidatePath("/ubicaciones");
  revalidatePath("/activos");

  return { ok: true };
}
