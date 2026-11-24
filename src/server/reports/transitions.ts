import type { ReportStatus } from "@/generated/prisma/enums";
import { can, type Action, type Viewer } from "@/server/auth/permissions";

// Único lugar donde se decide qué cambios de estado existen y quién los hace.

export const OPEN_REPORT_STATUSES = [
  "REPORTED",
  "ASSIGNED",
  "IN_PROGRESS",
] as const satisfies readonly ReportStatus[];

export type OpenReportStatus = (typeof OPEN_REPORT_STATUSES)[number];

export function isOpenReportStatus(
  status: ReportStatus,
): status is OpenReportStatus {
  return (OPEN_REPORT_STATUSES as readonly ReportStatus[]).includes(status);
}

export const REPORT_OPERATIONS = [
  "assign",
  "start",
  "resolve",
  "reject",
  "prioritize",
  "comment",
] as const;

export type ReportOperation = (typeof REPORT_OPERATIONS)[number];

export type ReportState = {
  status: ReportStatus;
  assignedToId: string | null;
};

export type OperationCheck =
  | { ok: true; to: ReportStatus }
  | { ok: false; reason: "forbidden" | "invalid" };

type OperationRule = {
  action: Action;
  transitions: Partial<Record<ReportStatus, ReportStatus>>;
};

const rules: Record<ReportOperation, OperationRule> = {
  // Reasignar conserva el estado: un reporte en proceso sigue en proceso.
  assign: {
    action: "report:assign",
    transitions: {
      REPORTED: "ASSIGNED",
      ASSIGNED: "ASSIGNED",
      IN_PROGRESS: "IN_PROGRESS",
    },
  },
  start: {
    action: "report:changeStatus",
    transitions: { ASSIGNED: "IN_PROGRESS" },
  },
  resolve: {
    action: "report:changeStatus",
    transitions: { IN_PROGRESS: "RESOLVED" },
  },
  reject: {
    action: "report:reject",
    transitions: {
      REPORTED: "REJECTED",
      ASSIGNED: "REJECTED",
      IN_PROGRESS: "REJECTED",
    },
  },
  // La prioridad no mueve el estado; en un reporte cerrado ya no tiene efecto.
  prioritize: {
    action: "report:setPriority",
    transitions: {
      REPORTED: "REPORTED",
      ASSIGNED: "ASSIGNED",
      IN_PROGRESS: "IN_PROGRESS",
    },
  },
  // Una nota no mueve el estado; un reporte cerrado ya no admite notas.
  comment: {
    action: "report:comment",
    transitions: {
      REPORTED: "REPORTED",
      ASSIGNED: "ASSIGNED",
      IN_PROGRESS: "IN_PROGRESS",
    },
  },
};

// El permiso se revisa antes que el estado: quien no puede actuar no averigua en qué etapa va.
export function checkOperation(
  viewer: Viewer,
  report: ReportState,
  operation: ReportOperation,
): OperationCheck {
  const rule = rules[operation];

  if (!can(viewer, rule.action, report)) {
    return { ok: false, reason: "forbidden" };
  }

  const to = rule.transitions[report.status];

  return to ? { ok: true, to } : { ok: false, reason: "invalid" };
}

export function allowedOperations(
  viewer: Viewer,
  report: ReportState,
): ReportOperation[] {
  return REPORT_OPERATIONS.filter(
    (operation) => checkOperation(viewer, report, operation).ok,
  );
}

// ¿Podría hacerlo sobre algún reporte? Sirve para negar antes de consultar la BD.
export function canAttempt(viewer: Viewer, operation: ReportOperation) {
  const ownReport = viewer ? { assignedToId: viewer.id } : undefined;

  return can(viewer, rules[operation].action, ownReport);
}
