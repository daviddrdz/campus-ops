import type { ReportPriority, ReportStatus } from "@/generated/prisma/enums";
import { reportPriorityLabels, reportStatusLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

const statusColors: Record<ReportStatus, string> = {
  REPORTED: "text-status-fault",
  ASSIGNED: "text-primary",
  IN_PROGRESS: "text-status-maintenance",
  RESOLVED: "text-status-operational",
  REJECTED: "text-muted-foreground",
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap",
        statusColors[status],
      )}
    >
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {reportStatusLabels[status]}
    </span>
  );
}

// La prioridad alta lleva el amarillo de señal; las demás no llaman la atención.
export function ReportPriorityBadge({
  priority,
}: {
  priority: ReportPriority;
}) {
  const label = `Prioridad ${reportPriorityLabels[priority].toLowerCase()}`;

  if (priority === "HIGH") {
    return (
      <span className="inline-flex items-center rounded-[3px] bg-signal px-2 py-0.5 text-sm font-semibold whitespace-nowrap text-foreground">
        {label}
      </span>
    );
  }

  return (
    <span className="text-sm whitespace-nowrap text-muted-foreground">
      {label}
    </span>
  );
}
