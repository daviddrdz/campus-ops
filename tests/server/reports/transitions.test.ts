import { describe, expect, it } from "vitest";
import { ReportStatus } from "@/generated/prisma/enums";
import type { Viewer } from "@/server/auth/permissions";
import {
  allowedOperations,
  canAttempt,
  checkOperation,
  isOpenReportStatus,
  OPEN_REPORT_STATUSES,
  REPORT_OPERATIONS,
  type ReportOperation,
} from "@/server/reports/transitions";

const ALL_STATUSES = Object.values(ReportStatus);

const admin: Viewer = { id: "admin", role: "ADMIN", isActive: true };
const staff: Viewer = { id: "staff", role: "STAFF", isActive: true };
const technician: Viewer = { id: "tech", role: "TECHNICIAN", isActive: true };
const inactiveAdmin: Viewer = { id: "old", role: "ADMIN", isActive: false };

type ViewerCase = {
  name: string;
  viewer: Viewer;
  assignedToId: string | null;
};

const viewers: ViewerCase[] = [
  { name: "anónimo", viewer: null, assignedToId: "tech" },
  { name: "administrativo", viewer: staff, assignedToId: "tech" },
  { name: "admin", viewer: admin, assignedToId: "tech" },
  { name: "admin inactivo", viewer: inactiveAdmin, assignedToId: "tech" },
  { name: "técnico con su reporte", viewer: technician, assignedToId: "tech" },
  { name: "técnico con reporte ajeno", viewer: technician, assignedToId: "x" },
  { name: "técnico sin asignar", viewer: technician, assignedToId: null },
];

// Quién puede intentar cada operación sobre el reporte (sin mirar el estado).
const allowedViewers: Record<ReportOperation, string[]> = {
  assign: ["admin"],
  reject: ["admin"],
  start: ["admin", "técnico con su reporte"],
  resolve: ["admin", "técnico con su reporte"],
};

// Desde qué estado es válida cada operación y a qué estado lleva.
const validTransitions: Record<
  ReportOperation,
  Partial<Record<ReportStatus, ReportStatus>>
> = {
  assign: {
    REPORTED: "ASSIGNED",
    ASSIGNED: "ASSIGNED",
    IN_PROGRESS: "IN_PROGRESS",
  },
  start: { ASSIGNED: "IN_PROGRESS" },
  resolve: { IN_PROGRESS: "RESOLVED" },
  reject: {
    REPORTED: "REJECTED",
    ASSIGNED: "REJECTED",
    IN_PROGRESS: "REJECTED",
  },
};

const cases = REPORT_OPERATIONS.flatMap((operation) =>
  ALL_STATUSES.flatMap((from) =>
    viewers.map(({ name, viewer, assignedToId }) => {
      const to = validTransitions[operation][from];
      const expected = !allowedViewers[operation].includes(name)
        ? { ok: false, reason: "forbidden" }
        : to
          ? { ok: true, to }
          : { ok: false, reason: "invalid" };

      return { operation, from, name, viewer, assignedToId, expected };
    }),
  ),
);

describe("transiciones de reportes", () => {
  it("las tablas cubren todas las operaciones", () => {
    expect(Object.keys(validTransitions).sort()).toEqual(
      [...REPORT_OPERATIONS].sort(),
    );
    expect(Object.keys(allowedViewers).sort()).toEqual(
      [...REPORT_OPERATIONS].sort(),
    );
  });

  describe("checkOperation", () => {
    it.each(cases)(
      "$operation desde $from, $name",
      ({ operation, from, viewer, assignedToId, expected }) => {
        expect(
          checkOperation(viewer, { status: from, assignedToId }, operation),
        ).toEqual(expected);
      },
    );
  });

  describe("estados finales", () => {
    it.each(["RESOLVED", "REJECTED"] as const)(
      "%s no admite ninguna operación, ni del admin",
      (status) => {
        expect(
          allowedOperations(admin, { status, assignedToId: "tech" }),
        ).toEqual([]);
      },
    );
  });

  describe("allowedOperations", () => {
    it("el admin puede asignar o rechazar un reporte nuevo", () => {
      expect(
        allowedOperations(admin, { status: "REPORTED", assignedToId: null }),
      ).toEqual(["assign", "reject"]);
    });

    it("el admin puede reasignar, iniciar o rechazar uno asignado", () => {
      expect(
        allowedOperations(admin, { status: "ASSIGNED", assignedToId: "tech" }),
      ).toEqual(["assign", "start", "reject"]);
    });

    it("el técnico solo inicia su reporte asignado", () => {
      expect(
        allowedOperations(technician, {
          status: "ASSIGNED",
          assignedToId: "tech",
        }),
      ).toEqual(["start"]);
    });

    it("el técnico solo resuelve su reporte en proceso", () => {
      expect(
        allowedOperations(technician, {
          status: "IN_PROGRESS",
          assignedToId: "tech",
        }),
      ).toEqual(["resolve"]);
    });

    it("el técnico no tiene operaciones sobre un reporte ajeno", () => {
      expect(
        allowedOperations(technician, {
          status: "IN_PROGRESS",
          assignedToId: "x",
        }),
      ).toEqual([]);
    });

    it("el administrativo nunca tiene operaciones", () => {
      for (const status of ALL_STATUSES) {
        expect(
          allowedOperations(staff, { status, assignedToId: null }),
        ).toEqual([]);
      }
    });
  });

  describe("canAttempt", () => {
    it.each([
      ["anónimo", null, []],
      ["administrativo", staff, []],
      ["admin inactivo", inactiveAdmin, []],
      ["técnico", technician, ["start", "resolve"]],
      ["admin", admin, ["assign", "start", "resolve", "reject"]],
    ] as const)("%s", (_name, viewer, expected) => {
      expect(REPORT_OPERATIONS.filter((op) => canAttempt(viewer, op))).toEqual(
        expected,
      );
    });
  });

  describe("estados abiertos", () => {
    it("son reportado, asignado y en proceso", () => {
      expect([...OPEN_REPORT_STATUSES].sort()).toEqual(
        ["ASSIGNED", "IN_PROGRESS", "REPORTED"].sort(),
      );
    });

    it.each(ALL_STATUSES)("isOpenReportStatus(%s)", (status) => {
      expect(isOpenReportStatus(status)).toBe(
        ["REPORTED", "ASSIGNED", "IN_PROGRESS"].includes(status),
      );
    });
  });
});
