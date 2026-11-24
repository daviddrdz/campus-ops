import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AssetStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { getAssetView } from "@/server/assets/view";
import { getSession } from "@/server/auth/session";
import { submitReportAction } from "@/server/reports/actions";
import { ReportForm } from "./report-form";

const openReportNotices: Record<
  Exclude<AssetStatus, "OPERATIONAL">,
  { className: string; title: string }
> = {
  FAULT_REPORTED: {
    className: "border-status-fault",
    title: "Este equipo ya tiene una falla reportada.",
  },
  IN_MAINTENANCE: {
    className: "border-status-maintenance",
    title: "Un técnico ya está trabajando en este equipo.",
  },
};

function OpenReportNotice({ status }: { status: AssetStatus }) {
  if (status === "OPERATIONAL") {
    return null;
  }

  const notice = openReportNotices[status];

  return (
    <div
      role="note"
      className={cn("mt-6 border-l-4 bg-card px-4 py-3", notice.className)}
    >
      <p className="font-semibold">{notice.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Si es la misma falla, no hace falta reportarla otra vez. Si es otra,
        envía tu reporte.
      </p>
    </div>
  );
}

export async function ReportSheet({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [{ code }, viewer] = await Promise.all([params, getSession()]);
  const asset = await getAssetView(code, viewer);

  if (!asset) {
    notFound();
  }

  const assetHref = `/a/${code}`;

  return (
    <>
      <header className="border-b bg-card">
        <div className="mx-auto max-w-xl px-2 py-1">
          <Link
            href={assetHref}
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Volver a la ficha
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-10">
        <h1>Reportar falla</h1>
        <p className="mt-1 font-medium wrap-anywhere">{asset.name}</p>
        <p className="wrap-anywhere text-muted-foreground">
          {asset.location.building}, {asset.location.room}
        </p>

        <ReportForm
          action={submitReportAction.bind(null, code)}
          assetHref={assetHref}
          notice={<OpenReportNotice status={asset.status} />}
        />
      </div>
    </>
  );
}
