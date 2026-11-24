// Cada página de staff lo usa en su propio loading.tsx. Un loading.tsx envuelve
// también al layout de su carpeta, así que solo cubre la navegación entre páginas
// (donde el layout compartido no se vuelve a pintar) si está junto a cada página.
export function StaffLoading() {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Cargando…
    </p>
  );
}
