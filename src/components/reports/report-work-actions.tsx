"use client";

import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import {
  useServerForm,
  type FormAction,
} from "@/components/forms/use-server-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  REPORT_LIMITS,
  type ReportCommentField,
  type StatusChangeField,
} from "@/lib/validators/reports";

export function StartForm({
  action,
}: {
  action: FormAction<StatusChangeField>;
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
        name="note"
        label="Nota para la bitácora"
        optional
        error={state.fieldErrors?.note}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={2}
            maxLength={REPORT_LIMITS.note}
            placeholder="Por ejemplo: reviso el cable de corriente."
          />
        )}
      </Field>
      <FormMessage message={state.message ?? state.fieldErrors?.status} />
      <Button type="submit" disabled={isPending} className="h-11 w-full px-4">
        {isPending ? "Guardando…" : "Empezar a atenderlo"}
      </Button>
    </form>
  );
}

export function ResolveForm({
  action,
}: {
  action: FormAction<StatusChangeField>;
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
        name="note"
        label="¿Qué se hizo para resolverlo?"
        error={state.fieldErrors?.note}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            maxLength={REPORT_LIMITS.note}
            placeholder="Por ejemplo: se cambió la fuente de poder."
          />
        )}
      </Field>
      <p className="text-sm text-muted-foreground">
        El reporte se cierra y la nota queda en el historial del equipo.
      </p>
      <FormMessage message={state.message ?? state.fieldErrors?.status} />
      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full bg-status-operational px-4 text-white hover:bg-status-operational/85"
      >
        {isPending ? "Guardando…" : "Marcar como resuelto"}
      </Button>
    </form>
  );
}

export function CommentForm({
  action,
}: {
  action: FormAction<ReportCommentField>;
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
        name="message"
        label="Agregar una nota"
        error={state.fieldErrors?.message}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={2}
            maxLength={REPORT_LIMITS.note}
            placeholder="Por ejemplo: falta una pieza, llega el jueves."
          />
        )}
      </Field>
      <FormMessage message={state.message} />
      <Button
        type="submit"
        variant="secondary"
        disabled={isPending}
        className="h-11 px-4"
      >
        {isPending ? "Guardando…" : "Guardar nota"}
      </Button>
    </form>
  );
}
