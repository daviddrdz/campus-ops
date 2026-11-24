"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import type { AssetField } from "@/lib/validators/assets";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { createAsset, updateAsset } from "./service";

const FORBIDDEN = "No tienes permiso para administrar activos.";

export async function createAssetAction(
  _previous: FormState<AssetField>,
  formData: FormData,
): Promise<FormState<AssetField>> {
  const viewer = await requireUser();

  if (!can(viewer, "asset:manage")) {
    return { ok: false, message: FORBIDDEN };
  }

  const result = await createAsset(viewer, Object.fromEntries(formData));

  if (!result.ok) {
    return result;
  }

  revalidatePath("/activos");
  revalidatePath("/ubicaciones");
  redirect("/activos?aviso=creado");
}

export async function updateAssetAction(
  id: string,
  _previous: FormState<AssetField>,
  formData: FormData,
): Promise<FormState<AssetField>> {
  const viewer = await requireUser();

  if (!can(viewer, "asset:manage")) {
    return { ok: false, message: FORBIDDEN };
  }

  const result = await updateAsset(viewer, id, Object.fromEntries(formData));

  if (!result.ok) {
    return result;
  }

  revalidatePath("/activos");
  revalidatePath("/ubicaciones");
  redirect("/activos?aviso=actualizado");
}
