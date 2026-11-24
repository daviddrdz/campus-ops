"use client";

import Link from "next/link";
import { Field } from "@/components/forms/field";
import {
  useServerForm,
  type FormAction,
} from "@/components/forms/use-server-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { AssetType } from "@/generated/prisma/enums";
import { assetTypeLabels } from "@/lib/labels";
import { ASSET_LIMITS, type AssetField } from "@/lib/validators/assets";

type AssetValues = {
  inventoryNumber: string;
  name: string;
  type: AssetType;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  specifications: string | null;
  locationId: string;
};

type AssetFormProps = {
  action: FormAction<AssetField>;
  locations: { id: string; building: string; room: string }[];
  asset?: AssetValues;
  submitLabel: string;
  pendingLabel: string;
};

const inputClass = "h-11 bg-card";

export function AssetForm({
  action,
  locations,
  asset,
  submitLabel,
  pendingLabel,
}: AssetFormProps) {
  const { formRef, state, isPending, handleSubmit } = useServerForm(action);
  const errors = state.fieldErrors ?? {};

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
    >
      <Field name="name" label="Nombre del equipo" error={errors.name}>
        {(control) => (
          <Input
            {...control}
            defaultValue={asset?.name}
            maxLength={ASSET_LIMITS.name}
            className={inputClass}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="inventoryNumber"
          label="Número de inventario"
          error={errors.inventoryNumber}
        >
          {(control) => (
            <Input
              {...control}
              defaultValue={asset?.inventoryNumber}
              maxLength={ASSET_LIMITS.inventoryNumber}
              autoCapitalize="characters"
              className={inputClass}
            />
          )}
        </Field>
        <Field name="type" label="Tipo" error={errors.type}>
          {(control) => (
            <NativeSelect {...control} defaultValue={asset?.type ?? ""}>
              <option value="" disabled>
                Elige un tipo
              </option>
              {Object.entries(assetTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

      <Field name="locationId" label="Ubicación" error={errors.locationId}>
        {(control) => (
          <NativeSelect {...control} defaultValue={asset?.locationId ?? ""}>
            <option value="" disabled>
              Elige una ubicación
            </option>
            {locations.map(({ id, building, room }) => (
              <option key={id} value={id}>
                {building}, {room}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="brand" label="Marca" error={errors.brand} optional>
          {(control) => (
            <Input
              {...control}
              defaultValue={asset?.brand ?? ""}
              maxLength={ASSET_LIMITS.brand}
              className={inputClass}
            />
          )}
        </Field>
        <Field name="model" label="Modelo" error={errors.model} optional>
          {(control) => (
            <Input
              {...control}
              defaultValue={asset?.model ?? ""}
              maxLength={ASSET_LIMITS.model}
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <Field
        name="serialNumber"
        label="Número de serie"
        error={errors.serialNumber}
        optional
      >
        {(control) => (
          <Input
            {...control}
            defaultValue={asset?.serialNumber ?? ""}
            maxLength={ASSET_LIMITS.serialNumber}
            className={inputClass}
          />
        )}
      </Field>

      <Field
        name="specifications"
        label="Especificaciones"
        error={errors.specifications}
        optional
      >
        {(control) => (
          <Textarea
            {...control}
            defaultValue={asset?.specifications ?? ""}
            maxLength={ASSET_LIMITS.specifications}
          />
        )}
      </Field>

      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/activos"
          className={buttonVariants({
            variant: "outline",
            className: "h-11 px-4",
          })}
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={isPending} className="h-11 px-4">
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
