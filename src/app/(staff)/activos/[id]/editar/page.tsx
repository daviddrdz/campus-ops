import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetForm } from "@/components/assets/asset-form";
import { AssetStatus } from "@/components/assets/asset-status";
import { updateAssetAction } from "@/server/assets/actions";
import { getAsset } from "@/server/assets/service";
import { requirePagePermission } from "@/server/auth/session";
import { listLocations } from "@/server/locations/service";

export const metadata: Metadata = {
  title: "Editar activo · CampusOps",
};

export default async function EditAssetPage({
  params,
}: PageProps<"/activos/[id]/editar">) {
  const viewer = await requirePagePermission("asset:manage");
  const { id } = await params;
  const [asset, locations] = await Promise.all([
    getAsset(viewer, id),
    listLocations(viewer),
  ]);

  if (!asset) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <div className="space-y-2">
        <h1>Editar activo</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="asset-plate">{asset.inventoryNumber}</span>
          <AssetStatus status={asset.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Código del QR: <span className="font-medium">{asset.publicCode}</span>
          . No cambia al editar, así las etiquetas impresas siguen funcionando.
        </p>
        <Link
          href={`/activos/${asset.id}/qr`}
          className="inline-block py-2 text-sm font-medium text-primary underline underline-offset-4"
        >
          Ver etiqueta QR
        </Link>
      </div>
      <AssetForm
        action={updateAssetAction.bind(null, asset.id)}
        asset={asset}
        locations={locations.map(({ id: locationId, building, room }) => ({
          id: locationId,
          building,
          room,
        }))}
        submitLabel="Guardar cambios"
        pendingLabel="Guardando…"
      />
    </section>
  );
}
