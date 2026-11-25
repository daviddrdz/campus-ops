import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { AssetStatus } from "@/components/assets/asset-status";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assetTypeLabels } from "@/lib/labels";
import { ASSET_LIMITS, assetSearchSchema } from "@/lib/validators/assets";
import { listAssets } from "@/server/assets/service";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Activos · CampusOps",
};

function noticeFor(notice: unknown) {
  if (notice === "creado") return "Activo creado.";
  if (notice === "actualizado") return "Cambios guardados.";

  return null;
}

export default async function AssetsPage({
  searchParams,
}: PageProps<"/activos">) {
  const viewer = await requirePagePermission("asset:manage");
  const { q, aviso } = await searchParams;
  const query = assetSearchSchema.parse(q ?? "");
  const assets = await listAssets(viewer, query);
  const notice = noticeFor(aviso);

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1>Activos</h1>
        <Link
          href="/activos/nuevo"
          className={buttonVariants({ className: "h-11 px-4" })}
        >
          Agregar activo
        </Link>
      </div>

      {notice ? (
        <p
          role="status"
          className="text-sm font-medium text-status-operational"
        >
          {notice}
        </p>
      ) : null}

      <Form action="/activos" role="search" className="flex gap-2">
        <Input
          key={query}
          name="q"
          type="search"
          defaultValue={query}
          maxLength={ASSET_LIMITS.search}
          placeholder="Nombre, marca o ubicación"
          aria-label="Buscar activos"
          className="h-11 bg-card"
        />
        <Button type="submit" variant="secondary" className="h-11 px-4">
          Buscar
        </Button>
      </Form>

      {assets.length === 0 ? (
        <div className="space-y-2 py-6">
          {query ? (
            <>
              <p>Ningún activo coincide con “{query}”.</p>
              <Link href="/activos" className="text-link">
                Ver todos los activos
              </Link>
            </>
          ) : (
            <p>Aún no hay activos. Agrega el primero para generar su ficha.</p>
          )}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {assets.map((asset) => {
            const makeAndModel = [asset.brand, asset.model]
              .filter(Boolean)
              .join(" ");

            return (
              <li key={asset.id}>
                <Link
                  href={`/activos/${asset.id}/editar`}
                  aria-label={`Editar ${asset.name}, inventario ${asset.inventoryNumber}`}
                  className="block space-y-2 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="asset-plate">{asset.inventoryNumber}</span>
                    <AssetStatus status={asset.status} />
                  </span>
                  <span className="block font-medium">{asset.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {assetTypeLabels[asset.type]}
                    {makeAndModel ? `, ${makeAndModel}` : ""}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {asset.location.building}, {asset.location.room}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
