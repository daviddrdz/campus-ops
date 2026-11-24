import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Reportes · CampusOps",
};

export default async function ReportsPage() {
  await requireUser();

  return (
    <section className="mx-auto max-w-2xl space-y-2">
      <h1 className="text-xl font-semibold tracking-tight">Reportes</h1>
      <p className="text-sm text-muted-foreground">
        La bandeja de reportes estará disponible pronto.
      </p>
    </section>
  );
}
