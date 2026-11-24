import type { z } from "zod";

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type FormState<Field extends string, Data = undefined> = {
  ok: boolean;
  message?: string;
  fieldErrors?: FieldErrors<Field>;
  data?: Data;
};

export type ServiceResult<Data, Field extends string> =
  | { ok: true; data: Data }
  | { ok: false; message?: string; fieldErrors?: FieldErrors<Field> };

export function fieldErrorsFrom<Field extends string>(
  error: z.ZodError,
): FieldErrors<Field> {
  const fieldErrors: FieldErrors<Field> = {};

  for (const issue of error.issues) {
    const field = issue.path[0] as Field;
    fieldErrors[field] ??= issue.message;
  }

  return fieldErrors;
}
