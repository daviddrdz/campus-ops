"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// En producción el mensaje real no llega al navegador; solo el digest para los logs.
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center px-4 py-12">
      <section className="mx-auto w-full max-w-sm space-y-3">
        <h1>No pudimos cargar esta pantalla</h1>
        <p className="text-muted-foreground">
          Revisa tu conexión e inténtalo de nuevo. Si vuelve a pasar, espera
          unos minutos.
        </p>
        <Button onClick={() => retry()} className="h-11 w-full">
          Intentar de nuevo
        </Button>
        <Link href="/" className="text-link">
          Ir al inicio
        </Link>
      </section>
    </main>
  );
}
