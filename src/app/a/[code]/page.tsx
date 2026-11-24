import type { Metadata } from "next";
import { Suspense } from "react";
import { AssetSheet } from "@/components/assets/asset-sheet";

export const metadata: Metadata = {
  title: "Ficha del equipo · CampusOps",
};

export default function AssetPage({ params }: PageProps<"/a/[code]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <p role="status" className="p-4 text-sm text-muted-foreground">
            Cargando equipo…
          </p>
        }
      >
        <AssetSheet params={params} />
      </Suspense>
    </main>
  );
}
