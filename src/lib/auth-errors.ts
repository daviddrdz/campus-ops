export const ACCOUNT_INACTIVE_CODE = "ACCOUNT_INACTIVE";

export function getLoginErrorMessage(error: {
  status?: number;
  code?: string;
}) {
  if (error.status === 429) {
    return "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";
  }

  if (error.code === ACCOUNT_INACTIVE_CODE) {
    return "Tu cuenta está desactivada. Contacta al administrador.";
  }

  if (error.code === "INVALID_EMAIL_OR_PASSWORD") {
    return "Correo o contraseña incorrectos.";
  }

  return "No pudimos iniciar sesión. Inténtalo de nuevo.";
}
