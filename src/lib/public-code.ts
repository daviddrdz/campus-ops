import { customAlphabet } from "nanoid";

// Sin 0, o, 1, i ni l: el código puede leerse de una etiqueta impresa.
export const PUBLIC_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const PUBLIC_CODE_LENGTH = 12;

export const generatePublicCode = customAlphabet(
  PUBLIC_CODE_ALPHABET,
  PUBLIC_CODE_LENGTH,
);
