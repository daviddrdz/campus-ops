// Reglas del despliegue, separadas de los scripts para poder probarlas sin efectos.

type Env = Partial<Record<string, string>>;

export const DEV_SEED_PASSWORD = "CampusOps-Dev-2026";
export const MIN_DEPLOYED_SEED_PASSWORD_LENGTH = 12;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalDatabaseUrl(url: string | undefined) {
  const parsed = URL.parse(url ?? "");

  return parsed !== null && LOCAL_HOSTS.has(parsed.hostname);
}

// La contraseña de los usuarios demo. Contra cualquier BD que no sea local (o con
// NODE_ENV=production) exige una propia: nunca la de desarrollo.
export function resolveSeedPassword(env: Env): string {
  const password = env.SEED_USER_PASSWORD;

  if (!password) {
    throw new Error("Falta SEED_USER_PASSWORD. Revisa .env.example.");
  }

  const deployed =
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    !isLocalDatabaseUrl(env.DATABASE_URL);

  if (!deployed) {
    return password;
  }

  if (password === DEV_SEED_PASSWORD) {
    throw new Error(
      "Fuera de la BD local de desarrollo, SEED_USER_PASSWORD no puede ser la contraseña de desarrollo.",
    );
  }

  if (password.length < MIN_DEPLOYED_SEED_PASSWORD_LENGTH) {
    throw new Error(
      `Fuera de la BD local de desarrollo, SEED_USER_PASSWORD debe tener al menos ${MIN_DEPLOYED_SEED_PASSWORD_LENGTH} caracteres.`,
    );
  }

  return password;
}

export type DeployMigrationPlan =
  { migrate: true } | { migrate: false; reason: string };

// Solo los despliegues de producción migran, y siempre por la conexión directa.
// Las vistas previas comparten las variables de producción si no tienen las suyas:
// migrar desde una rama sin revisar tocaría la BD real.
export function planDeployMigration(env: Env): DeployMigrationPlan {
  if (env.VERCEL_ENV !== "production") {
    return {
      migrate: false,
      reason: `VERCEL_ENV=${env.VERCEL_ENV ?? "(sin definir)"}: no se migra fuera de producción.`,
    };
  }

  if (!env.DATABASE_URL_UNPOOLED) {
    throw new Error(
      "Falta DATABASE_URL_UNPOOLED (conexión directa) para migrar en producción.",
    );
  }

  return { migrate: true };
}
