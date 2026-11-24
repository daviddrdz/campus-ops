import type { ReactNode } from "react";
import type { UserRole } from "@/generated/prisma/enums";
import { Suspense } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { staffNavItems } from "@/components/staff/nav-items";
import { StaffNav } from "@/components/staff/staff-nav";
import { Button } from "@/components/ui/button";
import { userRoleLabels } from "@/lib/labels";
import { signOutAction } from "@/server/auth/actions";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { listNotifications } from "@/server/notifications/service";

const emptyNotificationHints: Partial<Record<UserRole, string>> = {
  ADMIN: "Aquí te avisamos de cada reporte nuevo y de cada reporte resuelto.",
  TECHNICIAN: "Aquí te avisamos cuando te asignen un reporte.",
};

async function StaffShell({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const navItems = staffNavItems(user);
  const notifications = can(user, "notification:receive")
    ? await listNotifications(user)
    : null;

  return (
    <>
      <header className="border-b bg-card print:hidden">
        <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">
              {userRoleLabels[user.role]}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {notifications && (
              <NotificationBell
                initialFeed={notifications}
                emptyHint={emptyNotificationHints[user.role] ?? ""}
              />
            )}
            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="h-10 px-3">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
        <StaffNav items={navItems} />
      </header>
      <main className="flex-1 px-4 py-6 print:p-0">{children}</main>
    </>
  );
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={<p className="p-4 text-sm text-muted-foreground">Cargando…</p>}
    >
      <StaffShell>{children}</StaffShell>
    </Suspense>
  );
}
