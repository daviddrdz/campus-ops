"use client";

import { Field } from "@/components/forms/field";
import {
  useServerForm,
  type FormAction,
} from "@/components/forms/use-server-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSET_LIMITS, type LocationField } from "@/lib/validators/assets";

type LocationFormProps = {
  action: FormAction<LocationField>;
  location?: { building: string; room: string };
  submitLabel: string;
  pendingLabel: string;
  savedMessage?: string;
  onSaved?: () => void;
  onCancel?: () => void;
};

export function LocationForm({
  action,
  location,
  submitLabel,
  pendingLabel,
  savedMessage,
  onSaved,
  onCancel,
}: LocationFormProps) {
  const { formRef, state, isPending, handleSubmit } = useServerForm(
    action,
    onSaved,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="building" label="Edificio" error={errors.building}>
          {(control) => (
            <Input
              {...control}
              defaultValue={location?.building}
              maxLength={ASSET_LIMITS.building}
              className="h-11 bg-card"
            />
          )}
        </Field>
        <Field name="room" label="Aula o laboratorio" error={errors.room}>
          {(control) => (
            <Input
              {...control}
              defaultValue={location?.room}
              maxLength={ASSET_LIMITS.room}
              className="h-11 bg-card"
            />
          )}
        </Field>
      </div>

      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      {state.ok && savedMessage ? (
        <p role="status" className="text-sm text-status-operational">
          {savedMessage}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-11 px-4"
          >
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending} className="h-11 px-4">
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
