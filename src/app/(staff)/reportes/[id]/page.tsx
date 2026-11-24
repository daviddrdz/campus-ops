import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AssetStatus } from "@/components/assets/asset-status";
import {
  AssignForm,
  PriorityForm,
  RejectForm,
} from "@/components/reports/report-admin-actions";
import {
  ReportPriorityBadge,
  ReportStatusBadge,
} from "@/components/reports/report-badges";
import { ReportTimeline } from "@/components/reports/report-timeline";
import { formatDateTime } from "@/lib/dates";
import { faultTypeLabels } from "@/lib/labels";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import {
  assignReportAction,
  rejectReportAction,
  setReportPriorityAction,
} from "@/server/reports/actions";
import {
  getReportDetail,
  listTechnicians,
  type ReportDetail,
} from "@/server/reports/queries";

export const metadata: Metadata = {
  title: "Reporte · CampusOps",
};

const notices: Record<string, string> = {
  asignado: "Técnico asignado.",
  prioridad: "Prioridad actualizada.",
  rechazado: "Reporte rechazado.",
};

const linkClass =
  "inline-block py-2 text-sm font-medium text-primary underline underline-offset-4";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-0.5 py-3 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="wrap-anywhere whitespace-pre-line">{children}</dd>
    </div>
  );
}

function Reporter({ report }: { report: ReportDetail }) {
  if (!report.reporterName && !report.reporterEmail) {
    return <span className="text-muted-foreground">No dejó sus datos</span>;
  }

  return (
    <>
      {report.reporterName ? (
        <span className="block">{report.reporterName}</span>
      ) : null}
      {report.reporterEmail ? (
        <a
          href={`mailto:${report.reporterEmail}`}
          className="text-primary underline underline-offset-4"
        >
          {report.reporterEmail}
        </a>
      ) : null}
    </>
  );
}

async function AdminActions({
  viewer,
  report,
}: {
  viewer: Parameters<typeof listTechnicians>[0];
  report: ReportDetail;
}) {
  const { operations } = report;
  const canAssign = operations.includes("assign");
  const technicians = canAssign
    ? (await listTechnicians(viewer)).filter((t) => t.isActive)
    : [];

  return (
    <section
      aria-labelledby="actions-heading"
      className="space-y-5 rounded-lg border bg-card p-4"
    >
      <h2 id="actions-heading" className="font-heading text-xl font-semibold">
        Atender el reporte
      </h2>
      {canAssign ? (
        <AssignForm
          key={report.assignedToId ?? "none"}
          action={assignReportAction.bind(null, report.id)}
          technicians={technicians}
          currentId={report.assignedToId}
        />
      ) : null}
      {operations.includes("prioritize") ? (
        <PriorityForm
          key={report.priority}
          action={setReportPriorityAction.bind(null, report.id)}
          current={report.priority}
        />
      ) : null}
      {operations.includes("reject") ? (
        <div className="border-t pt-5">
          <RejectForm action={rejectReportAction.bind(null, report.id)} />
        </div>
      ) : null}
    </section>
  );
}

export default async function ReportPage({
  params,
  searchParams,
}: PageProps<"/reportes/[id]">) {
  const viewer = await requirePagePermission("report:listInbox");
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const report = await getReportDetail(viewer, id);

  if (!report) {
    notFound();
  }

  const notice = typeof aviso === "string" ? notices[aviso] : undefined;
  const adminOperations = report.operations.filter((op) =>
    ["assign", "prioritize", "reject"].includes(op),
  );
  const closingLabel =
    report.status === "REJECTED" ? "Motivo del rechazo" : "Nota de resolución";

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Link href="/reportes" className={linkClass}>
          Volver a reportes
        </Link>
        <h1 className="tabular-nums">Folio {report.folio}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ReportStatusBadge status={report.status} />
          <ReportPriorityBadge priority={report.priority} />
        </div>
        <p className="text-sm text-muted-foreground">
          Reportado el{" "}
          <time dateTime={report.createdAt.toISOString()}>
            {formatDateTime(report.createdAt)}
          </time>
        </p>
      </div>

      {notice ? (
        <p
          role="status"
          className="text-sm font-medium text-status-operational"
        >
          {notice}
        </p>
      ) : null}

      <section aria-labelledby="asset-heading" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="asset-plate">{report.asset.inventoryNumber}</span>
          <AssetStatus status={report.asset.status} />
        </div>
        <h2 id="asset-heading" className="text-lg font-medium wrap-anywhere">
          {report.asset.name}
        </h2>
        <p className="text-sm wrap-anywhere text-muted-foreground">
          {report.asset.location.building}, {report.asset.location.room}
        </p>
        <div className="flex flex-wrap gap-x-5">
          <Link href={`/a/${report.asset.publicCode}`} className={linkClass}>
            Ver ficha del equipo
          </Link>
          {can(viewer, "asset:manage") ? (
            <Link
              href={`/activos/${report.asset.id}/editar`}
              className={linkClass}
            >
              Editar activo
            </Link>
          ) : null}
        </div>
      </section>

      <dl className="divide-y border-y">
        <DetailRow label="Falla">{report.description}</DetailRow>
        <DetailRow label="Tipo de falla">
          {report.faultType ? (
            faultTypeLabels[report.faultType]
          ) : (
            <span className="text-muted-foreground">Sin especificar</span>
          )}
        </DetailRow>
        <DetailRow label="Quién reportó">
          <Reporter report={report} />
        </DetailRow>
        <DetailRow label="Técnico">
          {report.assignedTo ? (
            report.assignedTo.name
          ) : (
            <span className="text-muted-foreground">Sin asignar</span>
          )}
        </DetailRow>
        {report.resolutionNote ? (
          <DetailRow label={closingLabel}>{report.resolutionNote}</DetailRow>
        ) : null}
      </dl>

      {adminOperations.length > 0 ? (
        <AdminActions viewer={viewer} report={report} />
      ) : null}

      <section aria-labelledby="timeline-heading" className="space-y-4">
        <h2
          id="timeline-heading"
          className="font-heading text-xl font-semibold"
        >
          Bitácora
        </h2>
        <ReportTimeline events={report.events} />
      </section>
    </article>
  );
}
