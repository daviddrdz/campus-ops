import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportSheet } from "@/components/reports/report-sheet";

export const metadata: Metadata = {
  title: "Reportar falla · CampusOps",
};

export default function ReportPage({
  params,
}: PageProps<"/a/[code]/reportar">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <p role="status" className="p-4 text-sm text-muted-foreground">
            Cargando formulario…
          </p>
        }
      >
        <ReportSheet params={params} />
      </Suspense>
    </main>
  );
}
