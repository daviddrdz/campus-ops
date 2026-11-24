import {
  can,
  type Action,
  type ReportResource,
  type Viewer,
} from "./permissions";

export class AuthorizationError extends Error {
  constructor() {
    super("No tienes permiso para realizar esta acción.");
    this.name = "AuthorizationError";
  }
}

export function assertCan(
  viewer: Viewer,
  action: Action,
  resource?: ReportResource,
) {
  if (!can(viewer, action, resource)) {
    throw new AuthorizationError();
  }
}
