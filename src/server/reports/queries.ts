import type { ReportWhereInput } from "@/generated/prisma/models";
import { recordIdSchema } from "@/lib/validators/text";
import {
  reportFiltersSchema,
  type ReportFilters,
} from "@/lib/validators/reports";
import { buildAssetSearchFilter } from "@/server/assets/service";
import { assertCan, AuthorizationError } from "@/server/auth/guards";
import { can, canViewAllReports, type Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { allowedOperations, OPEN_REPORT_STATUSES } from "./transitions";

export const REPORTS_PAGE_SIZE = 20;

function assertCanListInbox(
  viewer: Viewer,
): asserts viewer is NonNullable<Viewer> {
  assertCan(viewer, "report:listInbox");

  if (!viewer) {
    throw new AuthorizationError();
  }
}

function buildInboxFilter(
  viewer: NonNullable<Viewer>,
  filters: ReportFilters,
): ReportWhereInput {
  const where: ReportWhereInput = {};

  if (filters.status === "open") {
    where.status = { in: [...OPEN_REPORT_STATUSES] };
  } else if (filters.status !== "all") {
    where.status = filters.status;
  }

  if (filters.assetQuery) {
    where.asset = buildAssetSearchFilter(filters.assetQuery);
  }

  if (!canViewAllReports(viewer)) {
    where.assignedToId = viewer.id;
  } else if (filters.technician === "none") {
    where.assignedToId = null;
  } else if (filters.technician) {
    where.assignedToId = filters.technician;
  }

  return where;
}

export async function listReports(viewer: Viewer, rawFilters?: unknown) {
  assertCanListInbox(viewer);
  const filters = reportFiltersSchema.parse(rawFilters ?? {});
  const where = buildInboxFilter(viewer, filters);

  const total = await db.report.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / REPORTS_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const reports = await db.report.findMany({
    where,
    orderBy: { folio: "desc" },
    skip: (page - 1) * REPORTS_PAGE_SIZE,
    take: REPORTS_PAGE_SIZE,
    select: {
      id: true,
      folio: true,
      status: true,
      priority: true,
      description: true,
      createdAt: true,
      asset: {
        select: {
          name: true,
          inventoryNumber: true,
          location: { select: { building: true, room: true } },
        },
      },
      assignedTo: { select: { name: true } },
    },
  });

  return {
    reports,
    total,
    page,
    pageCount,
    filters: { ...filters, page },
    scope: canViewAllReports(viewer) ? ("all" as const) : ("assigned" as const),
  };
}

export type ReportInbox = Awaited<ReturnType<typeof listReports>>;

export const MY_RECENT_CLOSED_LIMIT = 10;

const myReportSelect = {
  id: true,
  folio: true,
  status: true,
  priority: true,
  description: true,
  createdAt: true,
  assignedAt: true,
  resolvedAt: true,
  asset: {
    select: {
      name: true,
      location: { select: { building: true, room: true } },
    },
  },
} as const;

// Pantalla de trabajo del técnico: lo abierto y lo que cerró hace poco.
// Siempre se limita a los reportes asignados a quien consulta.
export async function listMyReports(viewer: Viewer) {
  assertCanListInbox(viewer);

  const [open, recentlyClosed] = await Promise.all([
    db.report.findMany({
      where: {
        assignedToId: viewer.id,
        status: { in: [...OPEN_REPORT_STATUSES] },
      },
      orderBy: [{ assignedAt: "asc" }, { folio: "asc" }],
      select: myReportSelect,
    }),
    db.report.findMany({
      where: {
        assignedToId: viewer.id,
        status: { in: ["RESOLVED", "REJECTED"] },
      },
      orderBy: [{ updatedAt: "desc" }, { folio: "desc" }],
      take: MY_RECENT_CLOSED_LIMIT,
      select: myReportSelect,
    }),
  ]);

  // Primero lo que ya está en proceso; dentro de cada grupo, prioridad alta arriba.
  const byPriority = (a: (typeof open)[number], b: (typeof open)[number]) =>
    Number(b.priority === "HIGH") - Number(a.priority === "HIGH");

  return {
    inProgress: open
      .filter((report) => report.status === "IN_PROGRESS")
      .toSorted(byPriority),
    assigned: open
      .filter((report) => report.status !== "IN_PROGRESS")
      .toSorted(byPriority),
    recentlyClosed,
  };
}

export type MyReports = Awaited<ReturnType<typeof listMyReports>>;
export type MyReport = MyReports["assigned"][number];

// Devuelve null tanto si no existe como si el usuario no puede verlo:
// un técnico no averigua si existe un reporte ajeno.
export async function getReportDetail(viewer: Viewer, rawId: unknown) {
  assertCan(viewer, "report:listInbox");
  const id = recordIdSchema.safeParse(rawId);

  if (!id.success) {
    return null;
  }

  const report = await db.report.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      folio: true,
      status: true,
      priority: true,
      description: true,
      faultType: true,
      reporterName: true,
      reporterEmail: true,
      resolutionNote: true,
      assignedToId: true,
      createdAt: true,
      assignedAt: true,
      resolvedAt: true,
      asset: {
        select: {
          id: true,
          publicCode: true,
          inventoryNumber: true,
          name: true,
          status: true,
          location: { select: { building: true, room: true } },
        },
      },
      assignedTo: { select: { name: true } },
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          type: true,
          createdAt: true,
          fromStatus: true,
          toStatus: true,
          message: true,
          priority: true,
          actor: { select: { name: true } },
          assignee: { select: { name: true } },
        },
      },
    },
  });

  if (!report || !can(viewer, "report:view", report)) {
    return null;
  }

  return { ...report, operations: allowedOperations(viewer, report) };
}

export type ReportDetail = NonNullable<
  Awaited<ReturnType<typeof getReportDetail>>
>;

export async function listTechnicians(viewer: Viewer) {
  assertCan(viewer, "report:listInbox");

  return db.user.findMany({
    where: { role: "TECHNICIAN" },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true },
  });
}
