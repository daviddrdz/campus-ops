import Link from "next/link";
import type { ReactNode } from "react";
import {
  ReportPriorityBadge,
  ReportStatusBadge,
} from "@/components/reports/report-badges";
import type { ReportStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/dates";
import { reportStatusLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { AssetReportSummary, StaffAssetView } from "@/server/assets/view";

// Solo se muestran a quien tiene sesión de staff; el DTO público no trae nada de esto.

const STAGES = [
  "REPORTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
] as const satisfies readonly ReportStatus[];

function StageSteps({ status }: { status: ReportStatus }) {
  const current = STAGES.indexOf(status as (typeof STAGES)[number]);

  return (
    <ol aria-label="Etapa del proceso" className="grid grid-cols-4 gap-1">
      {STAGES.map((stage, index) => (
        <li
          key={stage}
          aria-current={index === current ? "step" : undefined}
          className={cn(
            "border-t-4 pt-1 text-xs leading-tight",
            index <= current
              ? "border-status-maintenance"
              : "border-border text-muted-foreground",
            index === current && "font-semibold",
          )}
        >
          {reportStatusLabels[stage]}
        </li>
      ))}
    </ol>
  );
}

function ReportLink({
  report,
  children,
}: {
  report: AssetReportSummary;
  children: ReactNode;
}) {
  const className = "block space-y-1.5 px-4 py-3";

  if (!report.detailId) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Link
      href={`/reportes/${report.detailId}`}
      aria-label={`Folio ${report.folio}, ${reportStatusLabels[report.status]}`}
      className={cn(
        className,
        "outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
      )}
    >
      {children}
    </Link>
  );
}

function FolioLine({ report }: { report: AssetReportSummary }) {
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="font-heading text-lg font-semibold tabular-nums">
        Folio {report.folio}
      </span>
      <ReportStatusBadge status={report.status} />
    </span>
  );
}

function OpenReports({ reports }: { reports: AssetReportSummary[] }) {
  return (
    <section aria-labelledby="open-reports-heading" className="mt-8 space-y-3">
      <h2
        id="open-reports-heading"
        className="font-heading text-xl font-semibold"
      >
        En atención
      </h2>
      {reports.length === 0 ? (
        <p className="text-muted-foreground">
          No hay reportes abiertos para este equipo.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {reports.map((report) => (
            <li key={report.folio}>
              <ReportLink report={report}>
                <FolioLine report={report} />
                <StageSteps status={report.status} />
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
                  <span className="text-sm">
                    {report.technician ? (
                      <>
                        <span className="text-muted-foreground">Técnico: </span>
                        {report.technician}
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Sin técnico asignado
                      </span>
                    )}
                  </span>
                  <ReportPriorityBadge priority={report.priority} />
                </span>
                <span className="line-clamp-2 block text-sm wrap-anywhere">
                  {report.description}
                </span>
              </ReportLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function History({
  staff,
  inboxHref,
}: {
  staff: StaffAssetView["staff"];
  inboxHref: string | null;
}) {
  const { history, reportCount } = staff;

  return (
    <section aria-labelledby="history-heading" className="mt-8 space-y-3">
      <h2 id="history-heading" className="font-heading text-xl font-semibold">
        Historial de reportes
      </h2>
      {history.length === 0 ? (
        <p className="text-muted-foreground">
          Este equipo todavía no tiene reportes.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {history.map((report) => (
            <li key={report.folio}>
              <ReportLink report={report}>
                <FolioLine report={report} />
                <span className="block text-xs text-muted-foreground">
                  Reportado el{" "}
                  <time dateTime={report.createdAt.toISOString()}>
                    {formatDateTime(report.createdAt)}
                  </time>
                  {report.technician
                    ? `, atendido por ${report.technician}`
                    : ""}
                </span>
                <span className="line-clamp-2 block text-sm wrap-anywhere">
                  {report.description}
                </span>
                {report.resolutionNote ? (
                  <span className="block border-l-2 border-signal pl-3 text-sm wrap-anywhere whitespace-pre-line">
                    {report.resolutionNote}
                  </span>
                ) : null}
              </ReportLink>
            </li>
          ))}
        </ul>
      )}
      {reportCount > history.length ? (
        <p className="text-sm text-muted-foreground">
          Se muestran los {history.length} más recientes de {reportCount}.{" "}
          {inboxHref ? (
            <Link
              href={inboxHref}
              className="font-medium text-primary underline underline-offset-4"
            >
              Ver todos en la bandeja
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

export function AssetStaffSections({
  staff,
  inboxHref,
}: {
  staff: StaffAssetView["staff"];
  inboxHref: string | null;
}) {
  return (
    <>
      <OpenReports reports={staff.openReports} />
      <History staff={staff} inboxHref={inboxHref} />
    </>
  );
}
