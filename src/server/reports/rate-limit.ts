import type { Prisma } from "@/generated/prisma/client";
import { ReportRateLimitError } from "./errors";

// Solo aplica a reportes anónimos. El tope por IP es alto porque en el wifi del
// campus muchas personas comparten la misma IP pública.
export const ANONYMOUS_REPORT_LIMITS = {
  windowMs: 60 * 60 * 1000,
  perIp: 10,
  perAsset: 5,
} as const;

// Serializa los reportes anónimos de la misma IP hasta el fin de la transacción,
// para que dos envíos simultáneos no pasen ambos el conteo.
export async function lockReporterIp(
  tx: Prisma.TransactionClient,
  reporterIpHash: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${reporterIpHash}, 0))`;
}

// Llamar con la IP y el activo ya bloqueados (lockReporterIp y la fila del activo).
export async function assertWithinAnonymousLimits(
  tx: Prisma.TransactionClient,
  {
    assetId,
    reporterIpHash,
  }: { assetId: string; reporterIpHash: string | null },
) {
  const since = new Date(Date.now() - ANONYMOUS_REPORT_LIMITS.windowMs);

  if (reporterIpHash) {
    const fromIp = await tx.report.count({
      where: { reporterIpHash, createdAt: { gte: since } },
    });

    if (fromIp >= ANONYMOUS_REPORT_LIMITS.perIp) {
      throw new ReportRateLimitError("ip");
    }
  }

  const forAsset = await tx.report.count({
    where: { assetId, createdAt: { gte: since } },
  });

  if (forAsset >= ANONYMOUS_REPORT_LIMITS.perAsset) {
    throw new ReportRateLimitError("asset");
  }
}
