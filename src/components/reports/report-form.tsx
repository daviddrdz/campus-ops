"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Field } from "@/components/forms/field";
import {
  useServerForm,
  type FormAction,
} from "@/components/forms/use-server-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { faultTypeLabels } from "@/lib/labels";
import {
  HONEYPOT_FIELD,
  REPORT_LIMITS,
  type ReportField,
} from "@/lib/validators/reports";

const faultOptions = [
  { value: "", label: "No sé" },
  ...Object.entries(faultTypeLabels).map(([value, label]) => ({
    value,
    label,
  })),
];

const inputClass = "h-11 bg-card";

type ReportFormProps = {
  action: FormAction<ReportField, { folio: number }>;
  assetHref: string;
  // Se oculta al enviar: quien acaba de reportar no necesita el aviso.
  notice?: ReactNode;
};

function ReportSent({
  folio,
  assetHref,
}: {
  folio: number;
  assetHref: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="report-sent" className="mt-8 space-y-5">
      <h2
        id="report-sent"
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-3xl font-semibold outline-none"
      >
        Reporte enviado
      </h2>
      <div className="space-y-2">
        <p className="text-muted-foreground">Tu número de folio</p>
        <p className="asset-plate px-8 py-1 text-4xl">{folio}</p>
      </div>
      <p className="text-muted-foreground">
        Si necesitas preguntar por esta falla, menciona el folio al personal del
        campus.
      </p>
      <Link
        href={assetHref}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
      >
        Ver la ficha del equipo
      </Link>
    </section>
  );
}

export function ReportForm({ action, assetHref, notice }: ReportFormProps) {
  const { formRef, state, isPending, handleSubmit } = useServerForm(action);
  const errors = state.fieldErrors ?? {};

  if (state.ok && state.data) {
    return <ReportSent folio={state.data.folio} assetHref={assetHref} />;
  }

  return (
    <>
      {notice}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 space-y-7"
      >
        <Field
          name="description"
          label="¿Qué le pasa al equipo?"
          error={errors.description}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={4}
              maxLength={REPORT_LIMITS.description}
              placeholder="Por ejemplo: la imagen parpadea y se apaga al conectar el cable HDMI."
              className="text-base"
            />
          )}
        </Field>

        <fieldset
          aria-describedby={errors.faultType ? "fault-type-error" : undefined}
        >
          <legend className="mb-2 text-sm font-medium">
            Tipo de falla{" "}
            <span className="font-normal text-muted-foreground">
              (opcional)
            </span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {faultOptions.map(({ value, label }) => (
              <label
                key={value || "unknown"}
                className="flex min-h-12 cursor-pointer items-center rounded-lg border border-input bg-card px-3 py-2 leading-tight font-medium select-none has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input
                  type="radio"
                  name="faultType"
                  value={value}
                  defaultChecked={value === ""}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          {errors.faultType ? (
            <p id="fault-type-error" className="mt-2 text-sm text-destructive">
              {errors.faultType}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="space-y-4">
          <div>
            <legend className="text-sm font-medium">
              Tus datos{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </legend>
            <p className="mt-1 text-sm text-muted-foreground">
              Solo los ve el personal del campus, por si necesita más detalles.
            </p>
          </div>
          <Field name="reporterName" label="Nombre" error={errors.reporterName}>
            {(control) => (
              <Input
                {...control}
                autoComplete="name"
                maxLength={REPORT_LIMITS.reporterName}
                className={inputClass}
              />
            )}
          </Field>
          <Field
            name="reporterEmail"
            label="Correo"
            error={errors.reporterEmail}
          >
            {(control) => (
              <Input
                {...control}
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={REPORT_LIMITS.reporterEmail}
                className={inputClass}
              />
            )}
          </Field>
        </fieldset>

        <div
          aria-hidden="true"
          className="absolute -left-[9999px] size-px overflow-hidden"
        >
          <label>
            Sitio web
            <input
              type="text"
              name={HONEYPOT_FIELD}
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
        </div>

        {state.message ? (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          className="h-12 w-full bg-signal text-base font-semibold text-foreground hover:bg-signal/85"
        >
          {isPending ? "Enviando…" : "Enviar reporte"}
        </Button>
      </form>
    </>
  );
}
