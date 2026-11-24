import { can, canViewAllReports, type Viewer } from "@/server/auth/permissions";

export type NavItem = { href: string; label: string };

export function staffNavItems(viewer: Viewer): NavItem[] {
  const items: NavItem[] = [];

  if (can(viewer, "report:listInbox")) {
    items.push(
      canViewAllReports(viewer)
        ? { href: "/reportes", label: "Reportes" }
        : { href: "/mis-reportes", label: "Mis reportes" },
    );
  }

  if (can(viewer, "asset:manage")) {
    items.push(
      { href: "/activos", label: "Activos" },
      { href: "/ubicaciones", label: "Ubicaciones" },
    );
  }

  return items;
}
