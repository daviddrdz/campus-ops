import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const MIN_SECRET_LENGTH = 16;

// Toma la IP del primer salto de X-Forwarded-For (lo fija el proxy de despliegue)
// o de X-Real-IP. Sin proxy delante, el cliente podría inventarla: verificar en la Fase 12.
export function getClientIp(headers: Headers): string | null {
  const candidate =
    headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip");
  const ip = candidate?.trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");

  return ip && isIP(ip) ? ip.toLowerCase() : null;
}

// HMAC con un secreto de entorno: sin el secreto no se puede recuperar la IP
// probando las ~4 mil millones de direcciones IPv4.
export function hashIp(
  ip: string,
  secret: string | undefined = process.env.IP_HASH_SECRET,
): string {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Falta IP_HASH_SECRET (mínimo ${MIN_SECRET_LENGTH} caracteres). Revisa .env.example.`,
    );
  }

  return createHmac("sha256", secret).update(ip).digest("hex");
}
