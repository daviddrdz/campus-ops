import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  can,
  type Action,
  type Viewer,
} from "@/server/auth/permissions";

const admin: Viewer = { id: "admin", role: "ADMIN", isActive: true };
const staff: Viewer = { id: "staff", role: "STAFF", isActive: true };
const technician: Viewer = { id: "tech", role: "TECHNICIAN", isActive: true };

const ownReport = { assignedToId: "tech" };
const otherReport = { assignedToId: "other-tech" };
const unassignedReport = { assignedToId: null };

type Row = [
  action: Action,
  anonymous: boolean,
  staff: boolean,
  technician: boolean,
  admin: boolean,
];

const globalMatrix: Row[] = [
  ["asset:viewPublic", true, true, true, true],
  ["report:create", true, true, true, true],
  ["asset:viewStaffDetails", false, true, true, true],
  ["report:listInbox", false, true, true, true],
  ["report:assign", false, false, false, true],
  ["asset:manage", false, false, false, true],
  ["user:manage", false, false, false, true],
];

const resourceMatrix: [
  action: Action,
  anonymous: boolean,
  staff: boolean,
  admin: boolean,
  technicianOwn: boolean,
  technicianOther: boolean,
  technicianUnassigned: boolean,
  technicianWithoutResource: boolean,
][] = [
  ["report:view", false, true, true, true, false, false, false],
  ["report:changeStatus", false, false, true, true, false, false, false],
];

describe("can", () => {
  it("la tabla cubre todas las acciones", () => {
    const covered = [
      ...globalMatrix.map(([action]) => action),
      ...resourceMatrix.map(([action]) => action),
    ];

    expect([...covered].sort()).toEqual([...ACTIONS].sort());
  });

  describe.each(globalMatrix)(
    "%s",
    (
      action,
      anonymousAllowed,
      staffAllowed,
      technicianAllowed,
      adminAllowed,
    ) => {
      it(`anónimo: ${anonymousAllowed}`, () => {
        expect(can(null, action)).toBe(anonymousAllowed);
      });
      it(`administrativo: ${staffAllowed}`, () => {
        expect(can(staff, action)).toBe(staffAllowed);
      });
      it(`técnico: ${technicianAllowed}`, () => {
        expect(can(technician, action)).toBe(technicianAllowed);
      });
      it(`admin: ${adminAllowed}`, () => {
        expect(can(admin, action)).toBe(adminAllowed);
      });
    },
  );

  describe.each(resourceMatrix)(
    "%s",
    (
      action,
      anonymousAllowed,
      staffAllowed,
      adminAllowed,
      ownAllowed,
      otherAllowed,
      unassignedAllowed,
      withoutResourceAllowed,
    ) => {
      it(`anónimo: ${anonymousAllowed}`, () => {
        expect(can(null, action, ownReport)).toBe(anonymousAllowed);
      });
      it(`administrativo: ${staffAllowed}`, () => {
        expect(can(staff, action, otherReport)).toBe(staffAllowed);
      });
      it(`admin: ${adminAllowed}`, () => {
        expect(can(admin, action, otherReport)).toBe(adminAllowed);
      });
      it(`técnico con su reporte: ${ownAllowed}`, () => {
        expect(can(technician, action, ownReport)).toBe(ownAllowed);
      });
      it(`técnico con reporte ajeno: ${otherAllowed}`, () => {
        expect(can(technician, action, otherReport)).toBe(otherAllowed);
      });
      it(`técnico con reporte sin asignar: ${unassignedAllowed}`, () => {
        expect(can(technician, action, unassignedReport)).toBe(
          unassignedAllowed,
        );
      });
      it(`técnico sin indicar el reporte: ${withoutResourceAllowed}`, () => {
        expect(can(technician, action)).toBe(withoutResourceAllowed);
      });
    },
  );

  describe("usuario inactivo", () => {
    it.each([
      ["ADMIN", "inactive-admin"],
      ["STAFF", "inactive-staff"],
      ["TECHNICIAN", "inactive-tech"],
    ] as const)("%s solo conserva los permisos públicos", (role, id) => {
      const inactive: Viewer = { id, role, isActive: false };

      for (const action of ACTIONS) {
        const resource = { assignedToId: id };
        expect(can(inactive, action, resource)).toBe(
          can(null, action, resource),
        );
      }
    });
  });
});
