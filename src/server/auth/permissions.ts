import type { UserRole } from "@/generated/prisma/enums";

export const ACTIONS = [
  "asset:viewPublic",
  "report:create",
  "asset:viewStaffDetails",
  "report:listInbox",
  "report:view",
  "report:assign",
  "report:reject",
  "report:changeStatus",
  "asset:manage",
  "user:manage",
] as const;

export type Action = (typeof ACTIONS)[number];
export type Viewer = { id: string; role: UserRole; isActive: boolean } | null;
export type ReportResource = { assignedToId: string | null };

// "assigned" exige indicar el reporte: sin recurso, el permiso se niega.
type Rule = boolean | "assigned";

const permissions: Record<
  Action,
  { anonymous: boolean } & Record<UserRole, Rule>
> = {
  "asset:viewPublic": {
    anonymous: true,
    STAFF: true,
    TECHNICIAN: true,
    ADMIN: true,
  },
  "report:create": {
    anonymous: true,
    STAFF: true,
    TECHNICIAN: true,
    ADMIN: true,
  },
  "asset:viewStaffDetails": {
    anonymous: false,
    STAFF: true,
    TECHNICIAN: true,
    ADMIN: true,
  },
  // El técnico entra a la bandeja, pero el servicio debe filtrarla a sus reportes.
  "report:listInbox": {
    anonymous: false,
    STAFF: true,
    TECHNICIAN: true,
    ADMIN: true,
  },
  "report:view": {
    anonymous: false,
    STAFF: true,
    TECHNICIAN: "assigned",
    ADMIN: true,
  },
  "report:assign": {
    anonymous: false,
    STAFF: false,
    TECHNICIAN: false,
    ADMIN: true,
  },
  "report:reject": {
    anonymous: false,
    STAFF: false,
    TECHNICIAN: false,
    ADMIN: true,
  },
  "report:changeStatus": {
    anonymous: false,
    STAFF: false,
    TECHNICIAN: "assigned",
    ADMIN: true,
  },
  "asset:manage": {
    anonymous: false,
    STAFF: false,
    TECHNICIAN: false,
    ADMIN: true,
  },
  "user:manage": {
    anonymous: false,
    STAFF: false,
    TECHNICIAN: false,
    ADMIN: true,
  },
};

export function can(
  viewer: Viewer,
  action: Action,
  resource?: ReportResource,
): boolean {
  const rule = permissions[action];

  if (!viewer?.isActive) {
    return rule.anonymous;
  }

  const roleRule = rule[viewer.role];

  if (roleRule === "assigned") {
    return resource?.assignedToId === viewer.id;
  }

  return roleRule;
}
