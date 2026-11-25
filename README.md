# Campus Ops

Aplicación web para el mantenimiento de equipos de un campus: cada activo tiene un QR, cualquiera puede reportar una falla y el personal le da seguimiento.

## Desarrollo local

Requiere pnpm (11 o superior) y Docker. pnpm descarga solo la versión de Node fijada en `package.json` (26.13.1).

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Agrega a `.env` valores para `BETTER_AUTH_SECRET` e `IP_HASH_SECRET`, cada uno generado con `openssl rand -base64 32`. Después:

```bash
sudo systemctl start docker
sudo docker compose up -d --wait
pnpm db:reset
pnpm dev
```

La aplicación queda en <http://localhost:3000>. Antes de dar un cambio por terminado: `pnpm check` (lint, tipos y pruebas) y `pnpm build`.

## Usuarios de desarrollo

El seed crea estos usuarios. En local todos usan la contraseña `CampusOps-Dev-2026`, definida en `SEED_USER_PASSWORD`. **Esa contraseña es solo para desarrollo:** el seed se niega a usarla contra cualquier base de datos que no sea la local.

| Rol            | Correo                          |
| -------------- | ------------------------------- |
| Administrador  | `admin@campusops.test`          |
| Técnico        | `tecnico1@campusops.test`       |
| Técnico        | `tecnico2@campusops.test`       |
| Administrativo | `administrativo@campusops.test` |

## Variables de entorno

| Variable                | Local            | Producción (Vercel)                                             |
| ----------------------- | ---------------- | --------------------------------------------------------------- |
| `APP_URL`               | Obligatoria      | Obligatoria: la URL definitiva (va en los QR).                  |
| `DATABASE_URL`          | Obligatoria      | Obligatoria: cadena de Neon **con** pool (host con `-pooler`).  |
| `DATABASE_URL_UNPOOLED` | Opcional         | Obligatoria: cadena de Neon **sin** pool, para las migraciones. |
| `BETTER_AUTH_SECRET`    | Obligatoria      | Obligatoria, distinta de la local.                              |
| `IP_HASH_SECRET`        | Obligatoria      | Obligatoria, distinta de la local y de `BETTER_AUTH_SECRET`.    |
| `DATABASE_URL_TEST`     | Para `pnpm test` | No se usa.                                                      |
| `SEED_USER_PASSWORD`    | Para el seed     | No se carga en Vercel; se da en la terminal al correr el seed.  |

`.env.example` las describe todas. Ningún `.env` se versiona.

## Despliegue

Producción corre en **Vercel** con PostgreSQL en **Neon** (integración de Vercel Marketplace).

- **Instalación:** `pnpm install --frozen-lockfile` (fijado en `vercel.json`). Respeta `pnpm-workspace.yaml`: solo `@prisma/engines` puede correr scripts de instalación.
- **Build:** `pnpm vercel-build` = `prisma generate` → `prisma migrate deploy` (solo si `VERCEL_ENV=production`, por `DATABASE_URL_UNPOOLED`) → `next build`. El log del build muestra las versiones de Node y pnpm.
- **Node:** `engines.node` = `26.x` (Vercel), y `devEngines` fija 26.13.1 para los scripts de pnpm.
- **Vistas previas:** no migran. Necesitan su propia `DATABASE_URL` o fallan; no se usan en el MVP.
- **Salud:** `GET /api/health` responde `200 {"status":"ok"}`.

### Seed de demostración en producción

Se corre desde la terminal, sin escribir secretos en archivos ni en el historial (zsh):

```bash
read -rs "PROD_DB?URL directa de Neon (sin pool): "; echo
read -rs "DEMO_PW?Contraseña demo (12+ caracteres): "; echo
DATABASE_URL="$PROD_DB" SEED_USER_PASSWORD="$DEMO_PW" pnpm db:seed
unset PROD_DB DEMO_PW
```

Es idempotente: volver a correrlo no duplica datos ni cambia los códigos de los QR. Crea los mismos cuatro usuarios de la tabla de arriba con la contraseña dada.

### Etiquetas QR

El QR se genera al abrir la etiqueta, a partir de `APP_URL`: al cambiarla en Vercel y volver a desplegar, todas las etiquetas cambian solas. Para imprimir: entrar como ADMIN → **Activos** → abrir el equipo → **Ver etiqueta QR** → **Imprimir etiqueta** (70 mm de ancho). Antes de imprimir, revisa que la URL que muestra la página sea la de producción.
