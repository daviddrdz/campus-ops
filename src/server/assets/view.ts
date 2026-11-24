import { isPublicCode } from "@/lib/public-code";
import { assertCan } from "@/server/auth/guards";
import { can, type Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { OPEN_REPORT_STATUSES } from "@/server/reports/transitions";

// Lista permitida: cada campo agregado aquí llega al navegador de cualquier persona.
const publicAssetSelect = {
  name: true,
  type: true,
  brand: true,
  model: true,
  specifications: true,
  status: true,
  location: { select: { building: true, room: true } },
} as const;

function findPublicAsset(publicCode: string) {
  return db.asset.findUnique({
    where: { publicCode },
    select: publicAssetSelect,
  });
}

export type PublicAssetView = NonNullable<
  Awaited<ReturnType<typeof findPublicAsset>>
>;

export const ASSET_HISTORY_LIMIT = 10;

// Lo que el personal ve de cada reporte en la ficha. Sin contacto ni hash de IP
// de quien reportó: eso queda en el detalle del reporte.
const assetReportSelect = {
  id: true,
  folio: true,
  status: true,
  priority: true,
  description: true,
  resolutionNote: true,
  createdAt: true,
  resolvedAt: true,
  assignedToId: true,
  assignedTo: { select: { name: true } },
} as const;

type AssetReportRow = Awaited<
  ReturnType<typeof findAssetReports>
>["history"][number];

function findAssetReports(publicCode: string) {
  const where = { asset: { publicCode } };

  return Promise.all([
    db.report.findMany({
      where: { ...where, status: { in: [...OPEN_REPORT_STATUSES] } },
      orderBy: { folio: "asc" },
      select: assetReportSelect,
    }),
    db.report.findMany({
      where,
      orderBy: { folio: "desc" },
      take: ASSET_HISTORY_LIMIT,
      select: assetReportSelect,
    }),
    db.report.count({ where }),
  ]).then(([open, history, total]) => ({ open, history, total }));
}

// El técnico ve el historial del equipo, pero solo abre el detalle de los suyos.
function toReportSummary(viewer: Viewer, report: AssetReportRow) {
  const { id, assignedToId, assignedTo, ...summary } = report;

  return {
    ...summary,
    technician: assignedTo?.name ?? null,
    detailId: can(viewer, "report:view", { assignedToId }) ? id : null,
  };
}

export type AssetReportSummary = ReturnType<typeof toReportSummary>;

export type StaffAssetView = PublicAssetView & {
  staff: {
    inventoryNumber: string;
    serialNumber: string | null;
    openReports: AssetReportSummary[];
    history: AssetReportSummary[];
    reportCount: number;
  };
};

export type AssetView = PublicAssetView | StaffAssetView;

export function isStaffAssetView(view: AssetView): view is StaffAssetView {
  return "staff" in view;
}

async function findStaffAsset(
  publicCode: string,
  viewer: Viewer,
): Promise<StaffAssetView | null> {
  const [asset, reports] = await Promise.all([
    db.asset.findUnique({
      where: { publicCode },
      select: {
        ...publicAssetSelect,
        inventoryNumber: true,
        serialNumber: true,
      },
    }),
    findAssetReports(publicCode),
  ]);

  if (!asset) {
    return null;
  }

  const { inventoryNumber, serialNumber, ...publicFields } = asset;
  const summarize = (report: AssetReportRow) => toReportSummary(viewer, report);

  return {
    ...publicFields,
    staff: {
      inventoryNumber,
      serialNumber,
      openReports: reports.open.map(summarize),
      history: reports.history.map(summarize),
      reportCount: reports.total,
    },
  };
}

// El DTO se elige en el servidor: sin sesión de staff, solo la lista pública.
export async function getAssetView(
  code: string,
  viewer: Viewer,
): Promise<AssetView | null> {
  assertCan(viewer, "asset:viewPublic");

  if (!isPublicCode(code)) {
    return null;
  }

  if (can(viewer, "asset:viewStaffDetails")) {
    return findStaffAsset(code, viewer);
  }

  return findPublicAsset(code);
}
