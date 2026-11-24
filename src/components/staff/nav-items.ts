import { can, type Viewer } from "@/server/auth/permissions";

export type NavItem = { href: string; label: string };

export function staffNavItems(viewer: Viewer): NavItem[] {
  const items: NavItem[] = [];

  if (can(viewer, "report:listInbox")) {
    items.push({ href: "/reportes", label: "Reportes" });
  }

  if (can(viewer, "asset:manage")) {
    items.push(
      { href: "/activos", label: "Activos" },
      { href: "/ubicaciones", label: "Ubicaciones" },
    );
  }

  return items;
}
