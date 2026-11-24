"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      type="button"
      className="h-11 w-full px-4 sm:w-auto"
      onClick={() => window.print()}
    >
      Imprimir etiqueta
    </Button>
  );
}
