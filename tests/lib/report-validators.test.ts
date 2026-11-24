import { describe, expect, it } from "vitest";
import {
  REPORT_LIMITS,
  assignReportSchema,
  rejectReportSchema,
  reportInputSchema,
  statusChangeSchema,
} from "@/lib/validators/reports";

function errorsOf(result: { success: boolean; error?: { issues: unknown[] } }) {
  return (result.error?.issues ?? []) as { path: string[]; message: string }[];
}

describe("reportInputSchema", () => {
  it("acepta solo la descripción y deja lo demás en null", () => {
    expect(reportInputSchema.parse({ description: "  No enciende  " })).toEqual(
      {
        description: "No enciende",
        faultType: null,
        reporterName: null,
        reporterEmail: null,
      },
    );
  });

  it("convierte los campos vacíos del formulario en null", () => {
    expect(
      reportInputSchema.parse({
        description: "Pantalla rota",
        faultType: "",
        reporterName: "  ",
        reporterEmail: "",
      }),
    ).toMatchObject({
      faultType: null,
      reporterName: null,
      reporterEmail: null,
    });
  });

  it("guarda tipo de falla y contacto válidos", () => {
    expect(
      reportInputSchema.parse({
        description: "Sin red",
        faultType: "CONNECTIVITY",
        reporterName: "Ana",
        reporterEmail: "ana@escuela.mx",
      }),
    ).toMatchObject({
      faultType: "CONNECTIVITY",
      reporterName: "Ana",
      reporterEmail: "ana@escuela.mx",
    });
  });

  it("ignora campos que no son del formulario", () => {
    const parsed = reportInputSchema.parse({
      description: "Falla",
      status: "RESOLVED",
      priority: "HIGH",
      assignedToId: "x",
    });

    expect(Object.keys(parsed).sort()).toEqual(
      ["description", "faultType", "reporterEmail", "reporterName"].sort(),
    );
  });

  it.each([
    ["vacía", "   ", "Describe la falla."],
    [
      "demasiado larga",
      "a".repeat(REPORT_LIMITS.description + 1),
      `Usa máximo ${REPORT_LIMITS.description} caracteres.`,
    ],
  ])("rechaza una descripción %s", (_name, description, message) => {
    const result = reportInputSchema.safeParse({ description });

    expect(errorsOf(result)).toEqual([
      expect.objectContaining({ path: ["description"], message }),
    ]);
  });

  it("rechaza un correo mal formado", () => {
    const result = reportInputSchema.safeParse({
      description: "Falla",
      reporterEmail: "ana@",
    });

    expect(errorsOf(result)).toEqual([
      expect.objectContaining({
        path: ["reporterEmail"],
        message: "Escribe un correo válido.",
      }),
    ]);
  });

  it("rechaza un tipo de falla desconocido", () => {
    const result = reportInputSchema.safeParse({
      description: "Falla",
      faultType: "INCENDIO",
    });

    expect(errorsOf(result)[0]?.path).toEqual(["faultType"]);
  });
});

describe("assignReportSchema", () => {
  it("exige un técnico", () => {
    expect(errorsOf(assignReportSchema.safeParse({}))[0]).toMatchObject({
      path: ["technicianId"],
      message: "Elige un técnico.",
    });
  });
});

describe("statusChangeSchema", () => {
  it("permite iniciar sin nota", () => {
    expect(statusChangeSchema.parse({ status: "IN_PROGRESS" })).toEqual({
      status: "IN_PROGRESS",
      note: null,
    });
  });

  it("exige nota para resolver", () => {
    const result = statusChangeSchema.safeParse({
      status: "RESOLVED",
      note: "  ",
    });

    expect(errorsOf(result)).toEqual([
      expect.objectContaining({
        path: ["note"],
        message: "Escribe qué se hizo para resolverlo.",
      }),
    ]);
  });

  it.each(["REPORTED", "ASSIGNED", "REJECTED", "CLOSED"])(
    "no acepta %s como destino",
    (status) => {
      expect(
        errorsOf(statusChangeSchema.safeParse({ status }))[0]?.path,
      ).toEqual(["status"]);
    },
  );
});

describe("rejectReportSchema", () => {
  it("exige el motivo", () => {
    expect(
      errorsOf(rejectReportSchema.safeParse({ reason: "" }))[0],
    ).toMatchObject({
      path: ["reason"],
      message: "Escribe el motivo del rechazo.",
    });
  });
});
