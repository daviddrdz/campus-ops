import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-md space-y-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">CampusOps</p>
        <h1>¿Un equipo del campus falla?</h1>
        <p className="text-muted-foreground">
          Escanea con la cámara de tu celular el código QR de la etiqueta del
          equipo. Se abre su ficha y desde ahí envías el reporte, sin crear una
          cuenta.
        </p>
        <Link href="/login" className="text-link">
          Acceso para personal
        </Link>
      </section>
    </main>
  );
}
