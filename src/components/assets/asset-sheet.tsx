import Link from "next/link";
import { notFound } from "next/navigation";
import type { AssetStatus } from "@/generated/prisma/enums";
import { assetStatusLabels, assetTypeLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  getAssetView,
  isStaffAssetView,
  type AssetView,
} from "@/server/assets/view";
import { canViewAllReports, type Viewer } from "@/server/auth/permissions";
import { getSession } from "@/server/auth/session";
import { AssetStaffSections } from "./asset-staff-sections";

const statusBands: Record<
  AssetStatus,
  { className: string; description: string }
> = {
  OPERATIONAL: {
    className: "bg-status-operational",
    description: "Este equipo no tiene fallas pendientes.",
  },
  FAULT_REPORTED: {
    className: "bg-status-fault",
    description: "Ya hay una falla reportada y está pendiente de atención.",
  },
  IN_MAINTENANCE: {
    className: "bg-status-maintenance",
    description: "Un técnico está trabajando en este equipo.",
  },
};

function SheetRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="grid gap-0.5 py-3 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium wrap-anywhere whitespace-pre-line">{value}</dd>
    </div>
  );
}

// Enlaces de vuelta al área de staff; null para quien no tiene sesión.
function staffLinks(viewer: Viewer, inventoryNumber: string) {
  if (canViewAllReports(viewer)) {
    const query = new URLSearchParams({ estado: "todos", q: inventoryNumber });

    return {
      area: { href: "/reportes", label: "Reportes" },
      inbox: `/reportes?${query}`,
    };
  }

  return {
    area: { href: "/mis-reportes", label: "Mis reportes" },
    inbox: null,
  };
}

function AssetSheetView({
  code,
  asset,
  viewer,
}: {
  code: string;
  asset: AssetView;
  viewer: Viewer;
}) {
  const band = statusBands[asset.status];
  const staff = isStaffAssetView(asset) ? asset.staff : null;
  const links = staff ? staffLinks(viewer, staff.inventoryNumber) : null;

  return (
    <>
      <div className={cn("text-white", band.className)}>
        <div className="mx-auto max-w-xl px-4 pt-4 pb-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">CampusOps</p>
            {links ? (
              <Link
                href={links.area.href}
                className="-my-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-white/60"
              >
                {links.area.label}
              </Link>
            ) : null}
          </div>
          <p className="mt-8 font-heading text-5xl leading-none font-semibold">
            {assetStatusLabels[asset.status]}
          </p>
          <p className="mt-2">{band.description}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-28">
        <h1 className="wrap-anywhere">{asset.name}</h1>
        <p className="mt-1 wrap-anywhere text-muted-foreground">
          {asset.location.building}, {asset.location.room}
        </p>
        {staff ? (
          <p className="mt-3">
            <span className="asset-plate">{staff.inventoryNumber}</span>
          </p>
        ) : null}

        <dl className="mt-5 divide-y border-y">
          <SheetRow label="Tipo" value={assetTypeLabels[asset.type]} />
          <SheetRow label="Marca" value={asset.brand} />
          <SheetRow label="Modelo" value={asset.model} />
          {staff ? (
            <SheetRow label="Número de serie" value={staff.serialNumber} />
          ) : null}
          <SheetRow label="Especificaciones" value={asset.specifications} />
        </dl>

        {staff ? (
          <AssetStaffSections staff={staff} inboxHref={links?.inbox ?? null} />
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-card p-3">
        <div className="mx-auto max-w-xl">
          <Link
            href={`/a/${code}/reportar`}
            prefetch={false}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-signal text-base font-semibold text-foreground outline-none hover:bg-signal/85 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
          >
            Reportar falla
          </Link>
        </div>
      </div>
    </>
  );
}

export async function AssetSheet({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [{ code }, viewer] = await Promise.all([params, getSession()]);
  const asset = await getAssetView(code, viewer);

  if (!asset) {
    notFound();
  }

  return <AssetSheetView code={code} asset={asset} viewer={viewer} />;
}
