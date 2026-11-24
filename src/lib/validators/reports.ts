import { z } from "zod";
import { FaultType } from "@/generated/prisma/enums";
import { optionalText, requiredText } from "./text";

export const REPORT_LIMITS = {
  description: 1000,
  reporterName: 120,
  reporterEmail: 254,
  note: 1000,
} as const;

// Campo trampa del formulario público: oculto para las personas, solo un bot lo llena.
export const HONEYPOT_FIELD = "website";

const emptyToNull = (value: unknown) => (value === "" ? null : value);

export const reportInputSchema = z.object({
  description: z
    .string({ error: "Describe la falla." })
    .trim()
    .min(1, "Describe la falla.")
    .max(
      REPORT_LIMITS.description,
      `Usa máximo ${REPORT_LIMITS.description} caracteres.`,
    ),
  faultType: z
    .preprocess(
      emptyToNull,
      z.enum(FaultType, { error: "Elige un tipo de falla válido." }).nullish(),
    )
    .transform((value) => value ?? null),
  reporterName: optionalText(REPORT_LIMITS.reporterName),
  reporterEmail: optionalText(REPORT_LIMITS.reporterEmail).pipe(
    z.email("Escribe un correo válido.").nullable(),
  ),
});

export const assignReportSchema = z.object({
  technicianId: z
    .string({ error: "Elige un técnico." })
    .min(1, "Elige un técnico.")
    .max(64, "Elige un técnico."),
});

export const statusChangeSchema = z
  .object({
    status: z.enum(["IN_PROGRESS", "RESOLVED"], {
      error: "Ese cambio de estado no existe.",
    }),
    note: optionalText(REPORT_LIMITS.note),
  })
  .refine((input) => input.status !== "RESOLVED" || input.note, {
    path: ["note"],
    message: "Escribe qué se hizo para resolverlo.",
  });

export const rejectReportSchema = z.object({
  reason: requiredText("el motivo del rechazo", REPORT_LIMITS.note),
});

export type ReportField = keyof z.input<typeof reportInputSchema>;
export type AssignReportField = keyof z.input<typeof assignReportSchema>;
export type StatusChangeField = keyof z.input<typeof statusChangeSchema>;
export type RejectReportField = keyof z.input<typeof rejectReportSchema>;
