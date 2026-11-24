"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { FormState } from "@/lib/form-state";
import { HONEYPOT_FIELD, type ReportField } from "@/lib/validators/reports";
import { AuthorizationError } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { getClientIp, hashIp } from "@/server/client-ip";
import { ReportDomainError } from "./errors";
import { createReport } from "./service";

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
