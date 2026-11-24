"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
} from "react";
import type { FormState } from "@/lib/form-state";

export type FormAction<Field extends string> = (
  previous: FormState<Field>,
  formData: FormData,
) => Promise<FormState<Field>>;

export function useServerForm<Field extends string>(
  action: FormAction<Field>,
  onSaved?: () => void,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    FormState<Field>,
    FormData
  >(
    async (previous, formData) => {
      const result = await action(previous, formData);

      if (result.ok) {
        formRef.current?.reset();
        onSaved?.();
      }

      return result;
    },
    { ok: false },
  );

  useEffect(() => {
    if (state.fieldErrors) {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    }
  }, [state]);

  // Con <form action>, React vacía el formulario también cuando hay errores.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return { formRef, state, isPending, handleSubmit };
}
