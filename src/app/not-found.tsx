import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada · CampusOps",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center px-4 py-12">
      <section className="mx-auto max-w-sm space-y-2">
        <h1>No encontramos esta página</h1>
        <p className="text-muted-foreground">
          Revisa la dirección. Si quieres reportar un equipo, escanea otra vez
          el código QR de su etiqueta.
        </p>
        <Link href="/" className="text-link">
          Ir al inicio
        </Link>
      </section>
    </main>
  );
}
