import type { Prisma } from "@/generated/prisma/client";
import type {
  AssetStatus,
  ReportEventType,
  ReportPriority,
  ReportStatus,
} from "@/generated/prisma/enums";
import type { ReportUncheckedUpdateManyInput } from "@/generated/prisma/models";
import { fieldErrorsFrom, type ServiceResult } from "@/lib/form-state";
import { isPublicCode } from "@/lib/public-code";
import { recordIdSchema } from "@/lib/validators/text";
import {
  assignReportSchema,
  rejectReportSchema,
  reportInputSchema,
  reportPrioritySchema,
  statusChangeSchema,
  type AssignReportField,
  type RejectReportField,
  type ReportField,
  type ReportPriorityField,
  type StatusChangeField,
} from "@/lib/validators/reports";
import { assertCan, AuthorizationError } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { recomputeAssetStatus } from "./asset-status";
import { assertWithinAnonymousLimits, lockReporterIp } from "./rate-limit";
import {
  AssetNotFoundError,
  InvalidAssigneeError,
  InvalidTransitionError,
  ReportConflictError,
  ReportNotFoundError,
  UnchangedPriorityError,
} from "./errors";
import {
  canAttempt,
  checkOperation,
  type ReportOperation,
  type ReportState,
} from "./transitions";

// Errores: la entrada inválida vuelve como fieldErrors; lo demás se lanza
// (AuthorizationError o una subclase de ReportDomainError).

type Actor = NonNullable<Viewer>;

export type CreatedReport = { id: string; folio: number };

export type ReportChange = {
  id: string;
  folio: number;
  status: ReportStatus;
  assetStatus: AssetStatus;
};

type LoadedReport = ReportState & {
  id: string;
  folio: number;
  assetId: string;
  priority: ReportPriority;
};

type PlannedChange = {
  data?: Omit<ReportUncheckedUpdateManyInput, "status">;
  event: {
    type: ReportEventType;
    message?: string | null;
    assigneeId?: string;
    priority?: ReportPriority;
  };
};

function assertCanAttempt(
  viewer: Viewer,
  ...operations: ReportOperation[]
): asserts viewer is Actor {
  if (!viewer || !operations.some((op) => canAttempt(viewer, op))) {
    throw new AuthorizationError();
  }
}

function parseReportId(rawId: unknown): string {
  const id = recordIdSchema.safeParse(rawId);

  if (!id.success) {
    throw new ReportNotFoundError();
  }

  return id.data;
}

// Un solo camino para cualquier cambio: revisa permiso y transición, actualiza
// solo si nadie cambió el reporte entretanto, recalcula el activo y deja el evento.
// Todo en una transacción.
async function applyOperation(
  actor: Actor,
  reportId: string,
  operation: ReportOperation,
  plan: (
    tx: Prisma.TransactionClient,
    report: LoadedReport,
  ) => PlannedChange | Promise<PlannedChange>,
): Promise<ReportChange> {
  return db.$transaction(async (tx) => {
    const report = await tx.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        folio: true,
        status: true,
        assignedToId: true,
        assetId: true,
        priority: true,
      },
    });

    if (!report) {
      throw new ReportNotFoundError();
    }

    const check = checkOperation(actor, report, operation);

    if (!check.ok) {
      throw check.reason === "forbidden"
        ? new AuthorizationError()
        : new InvalidTransitionError(report.status, operation);
    }

    const { data, event } = await plan(tx, report);

    const { count } = await tx.report.updateMany({
      where: {
        id: report.id,
        status: report.status,
        assignedToId: report.assignedToId,
      },
      data: { ...data, status: check.to },
    });

    if (count !== 1) {
      throw new ReportConflictError();
    }

    const assetStatus = await recomputeAssetStatus(tx, report.assetId);

    await tx.reportEvent.create({
      data: {
        reportId: report.id,
        actorId: actor.id,
        fromStatus: report.status,
        toStatus: check.to,
        ...event,
      },
    });

    return {
      id: report.id,
      folio: report.folio,
      status: check.to,
      assetStatus,
    };
  });
}

export async function createReport(
  viewer: Viewer,
  rawAssetCode: unknown,
  rawInput: unknown,
  // Datos que pone el servidor, nunca el formulario.
  context: { reporterIpHash?: string | null } = {},
): Promise<ServiceResult<CreatedReport, ReportField>> {
  assertCan(viewer, "report:create");

  if (typeof rawAssetCode !== "string" || !isPublicCode(rawAssetCode)) {
    throw new AssetNotFoundError();
  }

  const input = reportInputSchema.safeParse(rawInput);

  if (!input.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(input.error) };
  }

  // Quien tiene sesión queda en la bitácora: no se limita ni se guarda su IP.
  const anonymous = !viewer?.isActive;
  const reporterIpHash = anonymous ? (context.reporterIpHash ?? null) : null;

  const report = await db.$transaction(async (tx) => {
    if (reporterIpHash) {
      await lockReporterIp(tx, reporterIpHash);
    }

    // Bloquea el activo desde el inicio para que el conteo por activo no se cruce
    // con otro reporte simultáneo. Mismo bloqueo que toma recomputeAssetStatus.
    const [asset] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Asset" WHERE "publicCode" = ${rawAssetCode} FOR NO KEY UPDATE
    `;

    if (!asset) {
      throw new AssetNotFoundError();
    }

    if (anonymous) {
      await assertWithinAnonymousLimits(tx, {
        assetId: asset.id,
        reporterIpHash,
      });
    }

    const created = await tx.report.create({
      data: {
        ...input.data,
        assetId: asset.id,
        reporterIpHash,
      },
      select: { id: true, folio: true, status: true },
    });

    await recomputeAssetStatus(tx, asset.id);

    await tx.reportEvent.create({
      data: {
        reportId: created.id,
        type: "CREATED",
        actorId: viewer?.isActive ? viewer.id : null,
        toStatus: created.status,
      },
    });

    return { id: created.id, folio: created.folio };
  });

  return { ok: true, data: report };
}

export async function assignReport(
  viewer: Viewer,
  rawReportId: unknown,
  rawInput: unknown,
): Promise<ServiceResult<ReportChange, AssignReportField>> {
  assertCanAttempt(viewer, "assign");
  const reportId = parseReportId(rawReportId);
  const input = assignReportSchema.safeParse(rawInput);

  if (!input.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(input.error) };
  }

  const { technicianId } = input.data;

  const change = await applyOperation(
    viewer,
    reportId,
    "assign",
    async (tx, report) => {
      if (report.assignedToId === technicianId) {
        throw new InvalidAssigneeError(
          "El reporte ya está asignado a ese técnico.",
        );
      }

      const technician = await tx.user.findUnique({
        where: { id: technicianId },
        select: { role: true, isActive: true },
      });

      if (technician?.role !== "TECHNICIAN" || !technician.isActive) {
        throw new InvalidAssigneeError();
      }

      return {
        data: { assignedToId: technicianId, assignedAt: new Date() },
        event: { type: "ASSIGNED", assigneeId: technicianId },
      };
    },
  );

  return { ok: true, data: change };
}

export async function changeReportStatus(
  viewer: Viewer,
  rawReportId: unknown,
  rawInput: unknown,
): Promise<ServiceResult<ReportChange, StatusChangeField>> {
  assertCanAttempt(viewer, "start", "resolve");
  const reportId = parseReportId(rawReportId);
  const input = statusChangeSchema.safeParse(rawInput);

  if (!input.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(input.error) };
  }

  const { status, note } = input.data;
  const resolving = status === "RESOLVED";

  const change = await applyOperation(
    viewer,
    reportId,
    resolving ? "resolve" : "start",
    () => ({
      data: resolving ? { resolutionNote: note, resolvedAt: new Date() } : {},
      event: { type: "STATUS_CHANGED", message: note },
    }),
  );

  return { ok: true, data: change };
}

export async function rejectReport(
  viewer: Viewer,
  rawReportId: unknown,
  rawInput: unknown,
): Promise<ServiceResult<ReportChange, RejectReportField>> {
  assertCanAttempt(viewer, "reject");
  const reportId = parseReportId(rawReportId);
  const input = rejectReportSchema.safeParse(rawInput);

  if (!input.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(input.error) };
  }

  const { reason } = input.data;

  // El motivo queda como nota de cierre del reporte y en la bitácora.
  const change = await applyOperation(viewer, reportId, "reject", () => ({
    data: { resolutionNote: reason },
    event: { type: "STATUS_CHANGED", message: reason },
  }));

  return { ok: true, data: change };
}

export async function setReportPriority(
  viewer: Viewer,
  rawReportId: unknown,
  rawInput: unknown,
): Promise<ServiceResult<ReportChange, ReportPriorityField>> {
  assertCanAttempt(viewer, "prioritize");
  const reportId = parseReportId(rawReportId);
  const input = reportPrioritySchema.safeParse(rawInput);

  if (!input.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(input.error) };
  }

  const { priority } = input.data;

  const change = await applyOperation(
    viewer,
    reportId,
    "prioritize",
    (_tx, report) => {
      if (report.priority === priority) {
        throw new UnchangedPriorityError();
      }

      return {
        data: { priority },
        event: { type: "PRIORITY_CHANGED", priority },
      };
    },
  );

  return { ok: true, data: change };
}
