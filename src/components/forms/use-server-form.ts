"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
} from "react";
import { unstable_rethrow } from "next/navigation";
import type { FormState } from "@/lib/form-state";

export type FormAction<Field extends string, Data = undefined> = (
  previous: FormState<Field, Data>,
  formData: FormData,
) => Promise<FormState<Field, Data>>;

// Sin señal (o con un fallo inesperado del servidor) la acción se rechaza: se avisa
// en el formulario y se conserva lo escrito, en lugar de mostrar la pantalla de error.
export const SUBMIT_FAILED_MESSAGE =
  "No pudimos enviar el formulario. Revisa tu conexión e inténtalo de nuevo.";

export function useServerForm<Field extends string, Data = undefined>(
  action: FormAction<Field, Data>,
  onSaved?: () => void,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    FormState<Field, Data>,
    FormData
  >(
    async (previous, formData) => {
      let result: FormState<Field, Data>;

      try {
        result = await action(previous, formData);
      } catch (error) {
        // redirect() y notFound() de Next también llegan como excepción.
        unstable_rethrow(error);
        console.error(error);

        return { ok: false, message: SUBMIT_FAILED_MESSAGE };
      }

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
