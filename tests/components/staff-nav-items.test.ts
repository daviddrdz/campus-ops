import { describe, expect, it } from "vitest";
import { staffNavItems } from "@/components/staff/nav-items";
import type { Viewer } from "@/server/auth/permissions";

const viewer = (
  role: NonNullable<Viewer>["role"],
  isActive = true,
): Viewer => ({
  id: role,
  role,
  isActive,
});

const labels = (v: Viewer) => staffNavItems(v).map((item) => item.label);

describe("navegación del área staff", () => {
  it("el ADMIN ve reportes, activos y ubicaciones", () => {
    expect(labels(viewer("ADMIN"))).toEqual([
      "Reportes",
      "Activos",
      "Ubicaciones",
    ]);
  });

  it.each(["STAFF", "TECHNICIAN"] as const)("%s solo ve reportes", (role) => {
    expect(labels(viewer(role))).toEqual(["Reportes"]);
  });

  it("sin sesión o inactivo no hay secciones", () => {
    expect(labels(null)).toEqual([]);
    expect(labels(viewer("ADMIN", false))).toEqual([]);
  });
});
