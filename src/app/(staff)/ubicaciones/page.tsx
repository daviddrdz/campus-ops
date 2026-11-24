import type { Metadata } from "next";
import { LocationForm } from "@/components/locations/location-form";
import { LocationRow } from "@/components/locations/location-row";
import { requirePagePermission } from "@/server/auth/session";
import { createLocationAction } from "@/server/locations/actions";
import { listLocations } from "@/server/locations/service";

export const metadata: Metadata = {
  title: "Ubicaciones · CampusOps",
};

export default async function LocationsPage() {
  const viewer = await requirePagePermission("asset:manage");
  const locations = await listLocations(viewer);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1>Ubicaciones</h1>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-medium">Agregar ubicación</h2>
        <LocationForm
          action={createLocationAction}
          submitLabel="Agregar ubicación"
          pendingLabel="Agregando…"
          savedMessage="Ubicación agregada."
        />
      </div>

      {locations.length === 0 ? (
        <p>Aún no hay ubicaciones. Agrega la primera con el formulario.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {locations.map(({ id, building, room, _count }) => (
            <LocationRow
              key={id}
              location={{ id, building, room, assetCount: _count.assets }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
