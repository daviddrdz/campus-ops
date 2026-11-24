import type { Prisma } from "@/generated/prisma/client";
import type { AssetStatus, ReportStatus } from "@/generated/prisma/enums";
import { OPEN_REPORT_STATUSES } from "./transitions";

export function deriveAssetStatus(
  reportStatuses: readonly ReportStatus[],
): AssetStatus {
  if (reportStatuses.includes("IN_PROGRESS")) {
    return "IN_MAINTENANCE";
  }

  if (reportStatuses.some((s) => s === "REPORTED" || s === "ASSIGNED")) {
    return "FAULT_REPORTED";
  }

  return "OPERATIONAL";
}

// Llamar dentro de la misma transacción que cambió el reporte.
export async function recomputeAssetStatus(
  tx: Prisma.TransactionClient,
  assetId: string,
): Promise<AssetStatus> {
  // Serializa los recálculos del mismo activo: sin el bloqueo, dos transacciones
  // simultáneas podrían no ver el reporte de la otra y dejar un estado viejo.
  // NO KEY UPDATE no choca con el bloqueo que toma la llave foránea al insertar un reporte.
  await tx.$queryRaw`SELECT 1 FROM "Asset" WHERE "id" = ${assetId} FOR NO KEY UPDATE`;

  const openReports = await tx.report.findMany({
    where: { assetId, status: { in: [...OPEN_REPORT_STATUSES] } },
    select: { status: true },
    distinct: ["status"],
  });
  const status = deriveAssetStatus(openReports.map((report) => report.status));

  await tx.asset.update({ where: { id: assetId }, data: { status } });

  return status;
}
