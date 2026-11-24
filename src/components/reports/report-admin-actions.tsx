"use client";

import { useState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import {
  useServerForm,
  type FormAction,
} from "@/components/forms/use-server-form";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ReportPriority } from "@/generated/prisma/enums";
import { reportPriorityLabels } from "@/lib/labels";
import {
  REPORT_LIMITS,
  type AssignReportField,
  type RejectReportField,
  type ReportPriorityField,
} from "@/lib/validators/reports";

type Technician = { id: string; name: string };

export function AssignForm({
  action,
  technicians,
  currentId,
}: {
  action: FormAction<AssignReportField>;
  technicians: Technician[];
  currentId: string | null;
}) {
  const { formRef, state, isPending, handleSubmit } = useServerForm(action);

  if (technicians.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay técnicos activos. Activa o crea uno para asignar el reporte.
      </p>
    );
  }

  const verb = currentId ? "Reasignar" : "Asignar";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-3"
    >
      <Field
        name="technicianId"
        label="Técnico"
        error={state.fieldErrors?.technicianId}
      >
        {(control) => (
          <NativeSelect {...control} defaultValue={currentId ?? ""}>
            {currentId ? null : (
              <option value="" disabled>
                Elige un técnico
              </option>
            )}
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <FormMessage message={state.message} />
      <Button type="submit" disabled={isPending} className="h-11 px-4">
        {isPending ? "Guardando…" : `${verb} técnico`}
      </Button>
    </form>
  );
}

export function PriorityForm({
  action,
  current,
}: {
  action: FormAction<ReportPriorityField>;
  current: ReportPriority;
}) {
  const { formRef, state, isPending, handleSubmit } = useServerForm(action);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-3"
    >
      <Field
        name="priority"
        label="Prioridad"
        error={state.fieldErrors?.priority}
      >
        {(control) => (
          <NativeSelect {...control} defaultValue={current}>
            {Object.entries(reportPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <FormMessage message={state.message} />
      <Button
        type="submit"
        variant="secondary"
        disabled={isPending}
        className="h-11 px-4"
      >
        {isPending ? "Guardando…" : "Guardar prioridad"}
      </Button>
    </form>
  );
}

export function RejectForm({
  action,
}: {
  action: FormAction<RejectReportField>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { formRef, state, isPending, handleSubmit } = useServerForm(action);

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="destructive"
        onClick={() => setIsOpen(true)}
        className="h-11 px-4"
      >
        Rechazar reporte
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-3 rounded-lg border border-destructive/40 p-4"
    >
      <p className="text-sm text-muted-foreground">
        Úsalo para duplicados o falsas alarmas. El reporte se cierra y el motivo
        queda en la bitácora.
      </p>
      <Field
        name="reason"
        label="Motivo del rechazo"
        error={state.fieldErrors?.reason}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            maxLength={REPORT_LIMITS.note}
            autoFocus
            placeholder="Por ejemplo: duplicado del folio 12."
          />
        )}
      </Field>
      <FormMessage message={state.message} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={isPending}
          className="h-11 bg-destructive px-4 text-white hover:bg-destructive/85"
        >
          {isPending ? "Rechazando…" : "Confirmar rechazo"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(false)}
          className="h-11 px-4"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
