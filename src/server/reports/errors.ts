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
  prioritize: "cambiar la prioridad de",
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

export class UnchangedPriorityError extends ReportDomainError {
  constructor() {
    super("El reporte ya tiene esa prioridad.");
  }
}

const rateLimitMessages = {
  ip: "Se enviaron demasiados reportes desde esta red en la última hora. Inténtalo más tarde o avisa al personal del campus.",
  asset:
    "Este equipo ya recibió varios reportes en la última hora. Inténtalo más tarde o avisa al personal del campus.",
} as const;

export class ReportRateLimitError extends ReportDomainError {
  constructor(readonly limit: keyof typeof rateLimitMessages) {
    super(rateLimitMessages[limit]);
  }
}

export class ReportConflictError extends ReportDomainError {
  constructor() {
    super(
      "Alguien más cambió este reporte al mismo tiempo. Recarga la página e inténtalo de nuevo.",
    );
  }
}
