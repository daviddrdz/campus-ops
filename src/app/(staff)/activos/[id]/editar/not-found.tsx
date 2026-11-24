import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AssetNotFound() {
  return (
    <section className="mx-auto max-w-xl space-y-3">
      <h1>Este activo no existe</h1>
      <p className="text-muted-foreground">
        Revisa el enlace o búscalo en la lista de activos.
      </p>
      <Link
        href="/activos"
        className={buttonVariants({ className: "h-11 px-4" })}
      >
        Ver activos
      </Link>
    </section>
  );
}
