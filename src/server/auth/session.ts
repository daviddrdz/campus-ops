import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/generated/prisma/enums";
import { auth } from "./auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

export class AuthorizationError extends Error {
  constructor() {
    super("No tienes permiso para realizar esta acción.");
    this.name = "AuthorizationError";
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user.isActive || !session.user.role) {
    return null;
  }

  const { id, name, email, role, isActive } = session.user;

  return { id, name, email, role: role as UserRole, isActive };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    throw new AuthorizationError();
  }

  return user;
}
