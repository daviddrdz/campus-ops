"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState, ServiceResult } from "@/lib/form-state";
import {
  HONEYPOT_FIELD,
  type AssignReportField,
  type RejectReportField,
  type ReportCommentField,
  type ReportField,
  type ReportPriorityField,
  type StatusChangeField,
} from "@/lib/validators/reports";
import { AuthorizationError } from "@/server/auth/guards";
import { getSession, requireUser } from "@/server/auth/session";
import { getClientIp, hashIp } from "@/server/client-ip";
import { ReportDomainError } from "./errors";
import {
  addReportComment,
  assignReport,
  changeReportStatus,
  createReport,
  rejectReport,
  setReportPriority,
} from "./service";

export type SubmitReportState = FormState<ReportField, { folio: number }>;

const REJECTED_SUBMISSION =
  "No pudimos enviar el reporte. Recarga la página e inténtalo de nuevo.";

export async function submitReportAction(
  code: string,
  _previous: SubmitReportState,
  formData: FormData,
): Promise<SubmitReportState> {
  if (formData.get(HONEYPOT_FIELD)) {
    return { ok: false, message: REJECTED_SUBMISSION };
  }

  const [viewer, requestHeaders] = await Promise.all([getSession(), headers()]);
  const ip = getClientIp(requestHeaders);

  try {
    const result = await createReport(
      viewer,
      code,
      Object.fromEntries(formData),
      { reporterIpHash: ip ? hashIp(ip) : null },
    );

    if (!result.ok) {
      return result;
    }

    revalidatePath(`/a/${code}`);

    return { ok: true, data: { folio: result.data.folio } };
  } catch (error) {
    if (
      error instanceof ReportDomainError ||
      error instanceof AuthorizationError
    ) {
      return { ok: false, message: error.message };
    }

    throw error;
  }
}

export type ReportChangeState<Field extends string> = FormState<Field>;

export type ReportChangeNotice =
  "asignado" | "prioridad" | "rechazado" | "en-proceso" | "resuelto" | "nota";

// Cambios desde el detalle del reporte (ADMIN o técnico asignado). El servicio
// revisa permisos; aquí solo se traducen los errores y se vuelve al detalle con un aviso.
async function runReportChange<Field extends string>(
  reportId: string,
  notice: ReportChangeNotice,
  change: (
    viewer: Awaited<ReturnType<typeof requireUser>>,
  ) => Promise<ServiceResult<unknown, Field>>,
): Promise<ReportChangeState<Field>> {
  const viewer = await requireUser();

  try {
    const result = await change(viewer);

    if (!result.ok) {
      return result;
    }
  } catch (error) {
    if (
      error instanceof ReportDomainError ||
      error instanceof AuthorizationError
    ) {
      return { ok: false, message: error.message };
    }

    throw error;
  }

  revalidatePath("/reportes");
  revalidatePath("/mis-reportes");
  revalidatePath(`/reportes/${reportId}`);
  revalidatePath("/a/[code]", "page");
  redirect(`/reportes/${reportId}?aviso=${notice}`);
}

export async function assignReportAction(
  reportId: string,
  _previous: ReportChangeState<AssignReportField>,
  formData: FormData,
): Promise<ReportChangeState<AssignReportField>> {
  return runReportChange(reportId, "asignado", (viewer) =>
    assignReport(viewer, reportId, Object.fromEntries(formData)),
  );
}

export async function setReportPriorityAction(
  reportId: string,
  _previous: ReportChangeState<ReportPriorityField>,
  formData: FormData,
): Promise<ReportChangeState<ReportPriorityField>> {
  return runReportChange(reportId, "prioridad", (viewer) =>
    setReportPriority(viewer, reportId, Object.fromEntries(formData)),
  );
}

export async function rejectReportAction(
  reportId: string,
  _previous: ReportChangeState<RejectReportField>,
  formData: FormData,
): Promise<ReportChangeState<RejectReportField>> {
  return runReportChange(reportId, "rechazado", (viewer) =>
    rejectReport(viewer, reportId, Object.fromEntries(formData)),
  );
}

// El estado destino lo fija la acción, no el formulario.
export async function startReportAction(
  reportId: string,
  _previous: ReportChangeState<StatusChangeField>,
  formData: FormData,
): Promise<ReportChangeState<StatusChangeField>> {
  return runReportChange(reportId, "en-proceso", (viewer) =>
    changeReportStatus(viewer, reportId, {
      note: formData.get("note"),
      status: "IN_PROGRESS",
    }),
  );
}

export async function resolveReportAction(
  reportId: string,
  _previous: ReportChangeState<StatusChangeField>,
  formData: FormData,
): Promise<ReportChangeState<StatusChangeField>> {
  return runReportChange(reportId, "resuelto", (viewer) =>
    changeReportStatus(viewer, reportId, {
      note: formData.get("note"),
      status: "RESOLVED",
    }),
  );
}

export async function commentReportAction(
  reportId: string,
  _previous: ReportChangeState<ReportCommentField>,
  formData: FormData,
): Promise<ReportChangeState<ReportCommentField>> {
  return runReportChange(reportId, "nota", (viewer) =>
    addReportComment(viewer, reportId, Object.fromEntries(formData)),
  );
}
