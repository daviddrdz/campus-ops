import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReportListItem } from "@/components/reports/report-list-item";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ReportStatus } from "@/generated/prisma/enums";
import { reportStatusLabels } from "@/lib/labels";
import { ASSET_LIMITS } from "@/lib/validators/assets";
import {
  STATUS_FILTER_ALL,
  TECHNICIAN_FILTER_NONE,
  type ReportFilters,
} from "@/lib/validators/reports";
import { canViewAllReports } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { listReports, listTechnicians } from "@/server/reports/queries";

export const metadata: Metadata = {
  title: "Reportes · CampusOps",
};

function statusParam(status: ReportFilters["status"]) {
  if (status === "open") return "";
  if (status === "all") return STATUS_FILTER_ALL;

  return status;
}

function technicianParam(technician: ReportFilters["technician"]) {
  if (technician === "none") return TECHNICIAN_FILTER_NONE;

  return technician ?? "";
}

function inboxHref(filters: ReportFilters, page: number) {
  const params = new URLSearchParams();
  const entries = {
    estado: statusParam(filters.status),
    q: filters.assetQuery,
    tecnico: technicianParam(filters.technician),
    pagina: page > 1 ? String(page) : "",
  };

  for (const [key, value] of Object.entries(entries)) {
    if (value) params.set(key, value);
  }

  const query = params.toString();

  return query ? `/reportes?${query}` : "/reportes";
}

function countLabel(total: number) {
  return total === 1 ? "1 reporte" : `${total} reportes`;
}

function isFiltered(filters: ReportFilters) {
  return (
    filters.status !== "open" ||
    Boolean(filters.assetQuery) ||
    filters.technician !== null
  );
}

export default async function ReportsPage({
  searchParams,
}: PageProps<"/reportes">) {
  const viewer = await requirePagePermission("report:listInbox");

  // El técnico trabaja desde su propia pantalla.
  if (!canViewAllReports(viewer)) {
    redirect("/mis-reportes");
  }

  const [inbox, technicians] = await Promise.all([
    listReports(viewer, await searchParams),
    listTechnicians(viewer),
  ]);
  const { filters, page, pageCount, total, reports } = inbox;

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-1">
        <h1>Reportes</h1>
        {viewer.role === "STAFF" ? (
          <p className="text-sm text-muted-foreground">
            Puedes consultar todos los reportes; la asignación la hace el
            administrador.
          </p>
        ) : null}
      </div>

      <Form
        action="/reportes"
        role="search"
        aria-label="Filtrar reportes"
        className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2"
      >
        <div className="space-y-1.5">
          <Label htmlFor="filter-status">Estado</Label>
          <NativeSelect
            key={filters.status}
            id="filter-status"
            name="estado"
            defaultValue={statusParam(filters.status)}
          >
            <option value="">Abiertos</option>
            {Object.values(ReportStatus).map((status) => (
              <option key={status} value={status}>
                {reportStatusLabels[status]}
              </option>
            ))}
            <option value={STATUS_FILTER_ALL}>Todos</option>
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-technician">Técnico</Label>
          <NativeSelect
            key={filters.technician ?? ""}
            id="filter-technician"
            name="tecnico"
            defaultValue={technicianParam(filters.technician)}
          >
            <option value="">Cualquiera</option>
            <option value={TECHNICIAN_FILTER_NONE}>Sin asignar</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.isActive
                  ? technician.name
                  : `${technician.name} (inactivo)`}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="filter-asset">Equipo</Label>
          <div className="flex gap-2">
            <Input
              key={filters.assetQuery}
              id="filter-asset"
              name="q"
              type="search"
              defaultValue={filters.assetQuery}
              maxLength={ASSET_LIMITS.search}
              placeholder="Nombre, inventario o ubicación"
              className="h-11 bg-card"
            />
            <Button type="submit" className="h-11 px-4">
              Filtrar
            </Button>
          </div>
        </div>
      </Form>

      <p role="status" className="text-sm text-muted-foreground">
        {countLabel(total)}
        {pageCount > 1 ? `, página ${page} de ${pageCount}` : ""}
      </p>

      {reports.length === 0 ? (
        <div className="space-y-2 py-4">
          {isFiltered(filters) ? (
            <>
              <p>Ningún reporte coincide con estos filtros.</p>
              <Link href="/reportes" className="text-link">
                Ver los reportes abiertos
              </Link>
            </>
          ) : (
            <p>No hay reportes abiertos. Los nuevos aparecerán aquí.</p>
          )}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {reports.map((report) => (
            <ReportListItem
              key={report.id}
              report={report}
              detail={report.assignedTo?.name ?? "Sin asignar"}
              date={{ label: "Reportado el", value: report.createdAt }}
            />
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="Páginas"
          className="flex items-center justify-between gap-3"
        >
          {page > 1 ? (
            <Link
              href={inboxHref(filters, page - 1)}
              className={buttonVariants({
                variant: "outline",
                className: "h-11 px-4",
              })}
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          {page < pageCount ? (
            <Link
              href={inboxHref(filters, page + 1)}
              className={buttonVariants({
                variant: "outline",
                className: "h-11 px-4",
              })}
            >
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
