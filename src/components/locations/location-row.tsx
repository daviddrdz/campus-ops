"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateLocationAction } from "@/server/locations/actions";
import { LocationForm } from "./location-form";

type LocationRowProps = {
  location: { id: string; building: string; room: string; assetCount: number };
};

function assetCountLabel(count: number) {
  if (count === 0) return "Sin activos";

  return count === 1 ? "1 activo" : `${count} activos`;
}

export function LocationRow({ location }: LocationRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <li className="bg-muted/50 px-4 py-4">
        <LocationForm
          action={updateLocationAction.bind(null, location.id)}
          location={location}
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
          onSaved={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{location.room}</p>
        <p className="text-sm text-muted-foreground">
          {location.building}, {assetCountLabel(location.assetCount)}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsEditing(true)}
        aria-label={`Editar ${location.building}, ${location.room}`}
        className="h-10 px-3"
      >
        Editar
      </Button>
    </li>
  );
}
