import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReportListItem } from "@/components/reports/report-list-item";
import { reportStatusLabels } from "@/lib/labels";
import { canViewAllReports } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { listMyReports, type MyReport } from "@/server/reports/queries";

export const metadata: Metadata = {
  title: "Mis reportes · CampusOps",
};

function ReportGroup({
  id,
  title,
  hint,
  reports,
  date,
}: {
  id: string;
  title: string;
  hint: string;
  reports: MyReport[];
  date: (report: MyReport) => { label: string; value: Date };
}) {
  if (reports.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={id} className="space-y-2">
      <div>
        <h2 id={id} className="font-heading text-xl font-semibold">
          {title}{" "}
          <span className="text-muted-foreground tabular-nums">
            ({reports.length})
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <ul className="divide-y overflow-hidden rounded-lg border bg-card">
        {reports.map((report) => (
          <ReportListItem key={report.id} report={report} date={date(report)} />
        ))}
      </ul>
    </section>
  );
}

const assignedDate = (report: MyReport) => ({
  label: "Asignado el",
  value: report.assignedAt ?? report.createdAt,
});

export default async function MyReportsPage() {
  const viewer = await requirePagePermission("report:listInbox");

  // Quien ve todos los reportes trabaja desde la bandeja general.
  if (canViewAllReports(viewer)) {
    redirect("/reportes");
  }

  const { inProgress, assigned, recentlyClosed } = await listMyReports(viewer);
  const hasOpen = inProgress.length + assigned.length > 0;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1>Mis reportes</h1>
        <p className="text-sm text-muted-foreground">
          Abre un reporte para empezar a atenderlo, dejar una nota o marcarlo
          como resuelto.
        </p>
      </div>

      {hasOpen ? null : (
        <p className="py-2">
          No tienes reportes abiertos. Cuando el administrador te asigne uno,
          aparecerá aquí.
        </p>
      )}

      <ReportGroup
        id="in-progress-heading"
        title={reportStatusLabels.IN_PROGRESS}
        hint="Ya los estás atendiendo. Resuélvelos con una nota de lo que hiciste."
        reports={inProgress}
        date={assignedDate}
      />

      <ReportGroup
        id="assigned-heading"
        title="Por iniciar"
        hint="Te los asignaron. Márcalos en proceso cuando empieces."
        reports={assigned}
        date={assignedDate}
      />

      <ReportGroup
        id="closed-heading"
        title="Cerrados recientemente"
        hint="Tus últimos reportes resueltos o rechazados."
        reports={recentlyClosed}
        date={(report) =>
          report.status === "RESOLVED" && report.resolvedAt
            ? { label: "Resuelto el", value: report.resolvedAt }
            : { label: "Reportado el", value: report.createdAt }
        }
      />
    </section>
  );
}
