# Campus Ops

Aplicación web para el mantenimiento de equipos de un campus: cada activo tiene un QR, cualquiera puede reportar una falla y el personal le da seguimiento.

## Desarrollo local

Requiere pnpm y Docker.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

Agrega a `.env` un valor para `BETTER_AUTH_SECRET`, generado con `openssl rand -base64 32`. Después:

```bash
sudo systemctl start docker
sudo docker compose up -d --wait
pnpm db:reset
pnpm dev
```

La aplicación queda en <http://localhost:3000>.

## Usuarios de desarrollo

El seed crea estos usuarios. Todos usan la contraseña `CampusOps-Dev-2026`, definida en `SEED_USER_PASSWORD`. **Son solo para desarrollo: nunca los uses en producción.**

| Rol            | Correo                          |
| -------------- | ------------------------------- |
| Administrador  | `admin@campusops.test`          |
| Técnico        | `tecnico1@campusops.test`       |
| Técnico        | `tecnico2@campusops.test`       |
| Administrativo | `administrativo@campusops.test` |
