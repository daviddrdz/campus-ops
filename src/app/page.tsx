export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-md space-y-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">CampusOps</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Mantenimiento de equipos del campus
        </h1>
        <p className="text-muted-foreground">
          Estamos preparando la plataforma para reportar fallas y dar
          seguimiento a cada reparación.
        </p>
      </section>
    </main>
  );
}
