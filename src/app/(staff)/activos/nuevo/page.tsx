import type { Metadata } from "next";
import Link from "next/link";
import { AssetForm } from "@/components/assets/asset-form";
import { buttonVariants } from "@/components/ui/button";
import { createAssetAction } from "@/server/assets/actions";
import { requirePagePermission } from "@/server/auth/session";
import { listLocations } from "@/server/locations/service";

export const metadata: Metadata = {
  title: "Agregar activo · CampusOps",
};

export default async function NewAssetPage() {
  const viewer = await requirePagePermission("asset:manage");
  const locations = await listLocations(viewer);

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <h1>Agregar activo</h1>
      {locations.length === 0 ? (
        <div className="space-y-3">
          <p>Cada activo necesita una ubicación. Agrega una para continuar.</p>
          <Link
            href="/ubicaciones"
            className={buttonVariants({ className: "h-11 px-4" })}
          >
            Agregar ubicación
          </Link>
        </div>
      ) : (
        <AssetForm
          action={createAssetAction}
          locations={locations.map(({ id, building, room }) => ({
            id,
            building,
            room,
          }))}
          submitLabel="Agregar activo"
          pendingLabel="Agregando…"
        />
      )}
    </section>
  );
}
