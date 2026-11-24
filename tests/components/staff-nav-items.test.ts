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

  it("el administrativo solo ve la bandeja de reportes", () => {
    expect(staffNavItems(viewer("STAFF"))).toEqual([
      { href: "/reportes", label: "Reportes" },
    ]);
  });

  it("el técnico solo ve sus reportes", () => {
    expect(staffNavItems(viewer("TECHNICIAN"))).toEqual([
      { href: "/mis-reportes", label: "Mis reportes" },
    ]);
  });

  it("sin sesión o inactivo no hay secciones", () => {
    expect(labels(null)).toEqual([]);
    expect(labels(viewer("ADMIN", false))).toEqual([]);
  });
});
