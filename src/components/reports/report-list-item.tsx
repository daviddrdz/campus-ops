import Link from "next/link";
import type { ReactNode } from "react";
import type { ReportPriority, ReportStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/dates";
import { reportStatusLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ReportPriorityBadge, ReportStatusBadge } from "./report-badges";

export type ReportListEntry = {
  id: string;
  folio: number;
  status: ReportStatus;
  priority: ReportPriority;
  description: string;
  asset: {
    name: string;
    location: { building: string; room: string };
  };
};

// Fila de la bandeja y de «Mis reportes». La prioridad alta lleva la franja amarilla.
export function ReportListItem({
  report,
  detail,
  date,
}: {
  report: ReportListEntry;
  detail?: ReactNode;
  date: { label: string; value: Date };
}) {
  return (
    <li>
      <Link
        href={`/reportes/${report.id}`}
        aria-label={`Folio ${report.folio}, ${report.asset.name}, ${reportStatusLabels[report.status]}`}
        className={cn(
          "block space-y-1.5 border-l-4 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          report.priority === "HIGH" ? "border-signal" : "border-transparent",
        )}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-heading text-xl font-semibold tabular-nums">
            Folio {report.folio}
          </span>
          <ReportStatusBadge status={report.status} />
        </span>
        <span className="block font-medium wrap-anywhere">
          {report.asset.name}
        </span>
        <span className="block text-sm wrap-anywhere text-muted-foreground">
          {report.asset.location.building}, {report.asset.location.room}
        </span>
        <span className="line-clamp-2 block text-sm wrap-anywhere">
          {report.description}
        </span>
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-0.5">
          <span className="text-sm text-muted-foreground">{detail}</span>
          <ReportPriorityBadge priority={report.priority} />
        </span>
        <span className="block text-xs text-muted-foreground">
          {date.label}{" "}
          <time dateTime={date.value.toISOString()}>
            {formatDateTime(date.value)}
          </time>
        </span>
      </Link>
    </li>
  );
}
