import type {
  AssetStatus,
  AssetType,
  FaultType,
  NotificationType,
  ReportEventType,
  ReportPriority,
  ReportStatus,
  UserRole,
} from "@/generated/prisma/enums";

export const userRoleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  TECHNICIAN: "Técnico",
  STAFF: "Administrativo",
};

export const assetTypeLabels: Record<AssetType, string> = {
  COMPUTER: "Computadora",
  DISPLAY: "Pantalla",
  PROJECTOR: "Proyector",
  LAB_EQUIPMENT: "Equipo de laboratorio",
  OTHER: "Otro",
};

export const assetStatusLabels: Record<AssetStatus, string> = {
  OPERATIONAL: "Funcionando",
  FAULT_REPORTED: "Falla reportada",
  IN_MAINTENANCE: "En mantenimiento",
};

export const reportStatusLabels: Record<ReportStatus, string> = {
  REPORTED: "Reportado",
  ASSIGNED: "Asignado",
  IN_PROGRESS: "En proceso",
  RESOLVED: "Resuelto",
  REJECTED: "Rechazado",
};

export const reportPriorityLabels: Record<ReportPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};

export const faultTypeLabels: Record<FaultType, string> = {
  HARDWARE: "Daño físico",
  SOFTWARE: "Programas o sistema",
  CONNECTIVITY: "Conexión o red",
  POWER: "No enciende",
  OTHER: "Otro",
};

export const reportEventTypeLabels: Record<ReportEventType, string> = {
  CREATED: "Reporte creado",
  ASSIGNED: "Técnico asignado",
  STATUS_CHANGED: "Cambio de estado",
  COMMENT: "Comentario",
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  REPORT_CREATED: "Reporte nuevo",
  REPORT_ASSIGNED: "Reporte asignado",
  REPORT_RESOLVED: "Reporte resuelto",
};
