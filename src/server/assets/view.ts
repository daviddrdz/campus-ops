import { isPublicCode } from "@/lib/public-code";
import { assertCan } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";

// Lista permitida: cada campo agregado aquí llega al navegador de cualquier persona.
const publicAssetSelect = {
  name: true,
  type: true,
  brand: true,
  model: true,
  specifications: true,
  status: true,
  location: { select: { building: true, room: true } },
} as const;

function findPublicAsset(publicCode: string) {
  return db.asset.findUnique({
    where: { publicCode },
    select: publicAssetSelect,
  });
}

export type PublicAssetView = NonNullable<
  Awaited<ReturnType<typeof findPublicAsset>>
>;

// La Fase 8 agrega aquí la vista de staff, elegida según el viewer.
export type AssetView = PublicAssetView;

export async function getAssetView(
  code: string,
  viewer: Viewer,
): Promise<AssetView | null> {
  assertCan(viewer, "asset:viewPublic");

  if (!isPublicCode(code)) {
    return null;
  }

  return findPublicAsset(code);
}
