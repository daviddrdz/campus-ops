import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function ReportNotFound() {
  return (
    <section className="mx-auto max-w-xl space-y-3">
      <h1>No encontramos este reporte</h1>
      <p className="text-muted-foreground">
        Revisa el enlace o búscalo en la bandeja de reportes.
      </p>
      <Link
        href="/reportes"
        className={buttonVariants({ className: "h-11 px-4" })}
      >
        Ver reportes
      </Link>
    </section>
  );
}
