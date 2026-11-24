export default function AssetCodeNotFound() {
  return (
    <main className="flex flex-1 items-center px-4 py-12">
      <section className="mx-auto max-w-sm space-y-2">
        <h1>No encontramos este equipo</h1>
        <p className="text-muted-foreground">
          Vuelve a escanear el código QR. Si la etiqueta está dañada, avisa al
          personal del campus.
        </p>
      </section>
    </main>
  );
}
