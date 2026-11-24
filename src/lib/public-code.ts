import { customAlphabet } from "nanoid";

// Sin 0, o, 1, i ni l: el código puede leerse de una etiqueta impresa.
export const PUBLIC_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const PUBLIC_CODE_LENGTH = 12;

const PUBLIC_CODE_PATTERN = new RegExp(
  `^[${PUBLIC_CODE_ALPHABET}]{${PUBLIC_CODE_LENGTH}}$`,
);

export const generatePublicCode = customAlphabet(
  PUBLIC_CODE_ALPHABET,
  PUBLIC_CODE_LENGTH,
);

export function isPublicCode(value: string) {
  return PUBLIC_CODE_PATTERN.test(value);
}
