import type { ReportStatus } from "@/generated/prisma/enums";
import { reportStatusLabels } from "@/lib/labels";
import type { ReportOperation } from "./transitions";

// Los mensajes están pensados para mostrarse tal cual en la interfaz.
export class ReportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ReportNotFoundError extends ReportDomainError {
  constructor() {
    super("Este reporte ya no existe.");
  }
}

export class AssetNotFoundError extends ReportDomainError {
  constructor() {
    super("No encontramos este equipo.");
  }
}

const operationVerbs: Record<ReportOperation, string> = {
  assign: "asignar",
  start: "iniciar",
  resolve: "resolver",
  reject: "rechazar",
};

export class InvalidTransitionError extends ReportDomainError {
  constructor(
    readonly from: ReportStatus,
    readonly operation: ReportOperation,
  ) {
    super(
      `No se puede ${operationVerbs[operation]} un reporte en estado «${reportStatusLabels[from]}».`,
    );
  }
}

export class InvalidAssigneeError extends ReportDomainError {
  constructor(message = "Elige un técnico activo.") {
    super(message);
  }
}

export class ReportConflictError extends ReportDomainError {
  constructor() {
    super(
      "Alguien más cambió este reporte al mismo tiempo. Recarga la página e inténtalo de nuevo.",
    );
  }
}
