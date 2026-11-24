import type { NotificationType } from "@/generated/prisma/enums";
import { db } from "@/server/db";

// Lo que pasó con un reporte, ya confirmado en la BD. `actorId` es quien lo hizo
// (null si fue un anónimo): nunca recibe aviso de su propia acción.
export type ReportNotificationEvent =
  | { type: "REPORT_CREATED"; reportId: string; actorId: string | null }
  | {
      type: "REPORT_ASSIGNED";
      reportId: string;
      actorId: string;
      assigneeId: string;
    }
  | { type: "REPORT_RESOLVED"; reportId: string; actorId: string };

type ReportSummary = {
  folio: number;
  asset: { name: string; location: { building: string; room: string } };
};

function describeAsset({ asset }: ReportSummary) {
  return `${asset.name} en ${asset.location.building}, ${asset.location.room}`;
}

const messages: Record<NotificationType, (report: ReportSummary) => string> = {
  REPORT_CREATED: (report) =>
    `Folio ${report.folio}: ${describeAsset(report)}.`,
  REPORT_ASSIGNED: (report) =>
    `Te asignaron el folio ${report.folio}: ${describeAsset(report)}.`,
  REPORT_RESOLVED: (report) =>
    `Folio ${report.folio} resuelto: ${describeAsset(report)}.`,
};

// Reglas: reporte nuevo y resuelto → ADMIN activos; asignación → el técnico asignado.
async function recipientsFor(event: ReportNotificationEvent) {
  const where =
    event.type === "REPORT_ASSIGNED"
      ? { id: event.assigneeId, role: "TECHNICIAN" as const }
      : { role: "ADMIN" as const };

  const users = await db.user.findMany({
    where: {
      ...where,
      isActive: true,
      ...(event.actorId ? { NOT: { id: event.actorId } } : {}),
    },
    select: { id: true },
  });

  return users.map(({ id }) => id);
}

// Crea los avisos de un evento. Se llama después de confirmar la transacción del
// reporte; si falla, lanza y quien llama decide (los servicios de reportes lo registran y siguen).
export async function notify(event: ReportNotificationEvent): Promise<number> {
  const [report, recipients] = await Promise.all([
    db.report.findUnique({
      where: { id: event.reportId },
      select: {
        folio: true,
        asset: {
          select: {
            name: true,
            location: { select: { building: true, room: true } },
          },
        },
      },
    }),
    recipientsFor(event),
  ]);

  if (!report || recipients.length === 0) {
    return 0;
  }

  const message = messages[event.type](report);

  const { count } = await db.notification.createMany({
    data: recipients.map((recipientId) => ({
      recipientId,
      reportId: event.reportId,
      type: event.type,
      message,
    })),
  });

  return count;
}
