import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetQrLabel } from "@/components/assets/asset-qr-label";
import { PrintButton } from "@/components/assets/print-button";
import { buildAssetUrl, generateQrSvg } from "@/lib/qr";
import { getAssetLabel } from "@/server/assets/service";
import { requirePagePermission } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Etiqueta QR · CampusOps",
};

export default async function AssetQrPage({
  params,
}: PageProps<"/activos/[id]/qr">) {
  const viewer = await requirePagePermission("asset:manage");
  const { id } = await params;
  const asset = await getAssetLabel(viewer, id);

  if (!asset) {
    notFound();
  }

  const assetUrl = buildAssetUrl(asset.publicCode);
  const qrSvg = await generateQrSvg(assetUrl);

  return (
    <section className="mx-auto max-w-xl space-y-5 print:max-w-none">
      <div className="space-y-2 print:hidden">
        <Link href={`/activos/${asset.id}/editar`} className="text-link">
          Volver al activo
        </Link>
        <h1>Etiqueta QR</h1>
        <p className="text-sm text-muted-foreground">
          Abre <span className="font-medium break-all">{assetUrl}</span>
        </p>
      </div>

      <AssetQrLabel
        name={asset.name}
        building={asset.location.building}
        room={asset.location.room}
        publicCode={asset.publicCode}
        qrSvg={qrSvg}
      />

      <div className="print:hidden">
        <PrintButton />
      </div>
    </section>
  );
}
