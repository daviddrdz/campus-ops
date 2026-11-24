import { z } from "zod";
import {
  FaultType,
  ReportPriority,
  ReportStatus,
} from "@/generated/prisma/enums";
import { assetSearchSchema } from "./assets";
import { optionalText, recordIdSchema, requiredText } from "./text";

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

export const reportCommentSchema = z.object({
  message: requiredText("la nota", REPORT_LIMITS.note),
});

export const reportPrioritySchema = z.object({
  priority: z.enum(ReportPriority, { error: "Elige una prioridad." }),
});

// Filtros de la bandeja tal como llegan en la URL (?estado=&q=&tecnico=&pagina=).
// Un valor inválido no rompe la página: vuelve al valor por defecto.
export const STATUS_FILTER_ALL = "todos";
export const TECHNICIAN_FILTER_NONE = "sin-asignar";

const firstValue = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

export const reportFiltersSchema = z
  .object({
    estado: z
      .preprocess(
        firstValue,
        z.union([z.enum(ReportStatus), z.literal(STATUS_FILTER_ALL)]),
      )
      .optional()
      .catch(undefined),
    q: z.preprocess(firstValue, assetSearchSchema),
    tecnico: z
      .preprocess(firstValue, recordIdSchema)
      .optional()
      .catch(undefined),
    pagina: z
      .preprocess(firstValue, z.coerce.number().int().min(1).max(100_000))
      .catch(1),
  })
  .transform(({ estado, q, tecnico, pagina }) => ({
    status:
      estado === undefined
        ? ("open" as const)
        : estado === STATUS_FILTER_ALL
          ? ("all" as const)
          : estado,
    assetQuery: q,
    technician:
      tecnico === TECHNICIAN_FILTER_NONE
        ? ("none" as const)
        : (tecnico ?? null),
    page: pagina,
  }));

export type ReportFilters = z.output<typeof reportFiltersSchema>;

export type ReportField = keyof z.input<typeof reportInputSchema>;
export type AssignReportField = keyof z.input<typeof assignReportSchema>;
export type StatusChangeField = keyof z.input<typeof statusChangeSchema>;
export type RejectReportField = keyof z.input<typeof rejectReportSchema>;
export type ReportPriorityField = keyof z.input<typeof reportPrioritySchema>;
export type ReportCommentField = keyof z.input<typeof reportCommentSchema>;
