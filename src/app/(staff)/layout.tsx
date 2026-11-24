import type { ReactNode } from "react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { userRoleLabels } from "@/lib/labels";
import { signOutAction } from "@/server/auth/actions";
import { requireUser } from "@/server/auth/session";

async function StaffShell({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">
            {userRoleLabels[user.role]}
          </p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="h-10">
            Cerrar sesión
          </Button>
        </form>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
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
