import { z } from "zod";

export function requiredText(label: string, max: number) {
  return z
    .string({ error: `Escribe ${label}.` })
    .trim()
    .min(1, `Escribe ${label}.`)
    .max(max, `Usa máximo ${max} caracteres.`);
}

export function optionalText(max: number) {
  return z
    .string({ error: "El valor no es válido." })
    .trim()
    .max(max, `Usa máximo ${max} caracteres.`)
    .nullish()
    .transform((value) => value || null);
}

export const recordIdSchema = z.string().min(1).max(64);
