# CampusOps

> **Estado: borrador de arranque.** Nada de este archivo es final ni obligatorio. Las tecnologías y las funcionalidades pueden cambiar.
> Si algo no está claro, contradice el código o implica una decisión que no está escrita aquí, **pregunta al usuario antes de asumir**.
> Cuando el usuario cambie una decisión, actualiza este archivo y `PLAN.md` en el mismo cambio.

## Qué es

Aplicación web para el mantenimiento y servicio de activos (computadoras, pantallas, proyectores, equipo de laboratorio) dentro de una universidad o campus.

**Problema:** dar mantenimiento a los equipos de una escuela es lento por la burocracia, y muchas veces la reparación no termina o no deja rastro.

**Idea central:** cada activo tiene un código QR. Al escanearlo se abre la página del activo, y **lo que se ve depende de quién escanea**:

| Quién escanea | Qué ve / puede hacer |
|---|---|
| Cualquier persona (sin cuenta) | Características del equipo, su estado (funciona / en mantenimiento / falla reportada) y un botón para **reportar una falla**. |
| Personal administrativo (con cuenta) | Lo anterior + a quién se asignó la reparación, en qué etapa del proceso va y el historial de reportes del equipo. |
| Administrador de reportes | Recibe notificaciones de cada reporte nuevo y **asigna un técnico**. |
| Técnico | Ve los reportes que se le asignaron, actualiza el avance y marca el reporte como resuelto. |

Contexto: proyecto de una materia universitaria, desarrollado por **una sola persona** con un plazo de **~1 semana** para el MVP. Prioriza terminar el flujo completo sobre agregar funciones.

Los borradores originales (`CampusOps_Idea_Breve.pdf`, `CampusOps_Propuesta_Empresarial.pdf`) contienen más ideas (SaaS, analítica, IoT, IA, costos, mantenimiento preventivo). Son **inspiración, no requisitos**. Ver "Fuera del MVP".

## Estado actual

- Fase actual: **Fase 2 terminada. Siguiente: Fase 3 (Activos y ubicaciones).**
- Última fase completada: Fase 2 (Autenticación y permisos).
- Verificado en la Fase 2: `pnpm check`, `pnpm build`, matriz de permisos completa y, sobre el build de producción en navegador con tamaño de celular, login y cierre de sesión de los 4 usuarios, redirección sin sesión y límite de intentos. Falta probarlo en un celular físico.
- Para correr `pnpm check` y `pnpm build` hacen falta PostgreSQL arriba y un `.env` copiado de `.env.example` con `BETTER_AUTH_SECRET`.
- Plan: `PLAN.md` — 13 fases (0–12), cada una pensada para **una sesión de Claude Code**, con pruebas propias y un criterio "Listo cuando".
- Actualiza esta sección al cerrar cada fase.

## Roles y permisos

Matriz confirmada e implementada en `src/server/auth/permissions.ts`.

| Acción | Público (sin cuenta) | ADMINISTRATIVO | TECNICO | ADMIN |
|---|:-:|:-:|:-:|:-:|
| Ver ficha pública del activo | ✅ | ✅ | ✅ | ✅ |
| Crear reporte de falla | ✅ | ✅ | ✅ | ✅ |
| Ver técnico asignado, etapa e historial del activo | ❌ | ✅ | ✅ | ✅ |
| Ver bandeja de reportes | ❌ | ✅ (solo lectura) | Solo los asignados a él | ✅ todos |
| Asignar técnico a un reporte | ❌ | ❌ | ❌ | ✅ |
| Cambiar estado de un reporte | ❌ | ❌ | Solo los suyos | ✅ |
| Crear/editar activos y generar QR | ❌ | ❌ | ❌ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ❌ | ✅ |

En código los roles son `ADMIN`, `TECHNICIAN` (Técnico) y `STAFF` (Administrativo); en la interfaz y en la documentación se usan sus nombres en español. No hay registro abierto: los usuarios con cuenta los crea el ADMIN (o el seed en desarrollo).

## Modelo de dominio (propuesta)

- **User** — nombre, correo, `emailVerified`, imagen opcional, rol (`ADMIN | TECHNICIAN | STAFF`), activo/inactivo. Lo gestiona la librería de auth.
- **Location** — edificio y aula/laboratorio.
- **Asset** — `publicCode` (aleatorio, va en el QR), número de inventario, nombre, tipo, marca, modelo, número de serie, especificaciones, ubicación, `status`.
- **Report** — `folio` autoincremental (el que ve quien reporta), activo, descripción, tipo de falla opcional, prioridad (por defecto `MEDIUM`; la define el ADMIN, no quien reporta), `status`, contacto opcional de quien reporta, hash de IP (`reporterIpHash`, para el límite de uso), técnico asignado, fechas, nota de resolución.
- **ReportEvent** — bitácora de cada reporte (creado, asignado, cambio de estado, comentario) con actor y fecha. Es lo que alimenta "en qué parte del proceso está" y el historial.
- **Notification** — destinatario, reporte, tipo, mensaje, fecha de lectura.

Estados (nombres en código en inglés, etiquetas en español en `lib/labels.ts`):

- `AssetStatus`: `OPERATIONAL` (Funcionando) · `FAULT_REPORTED` (Falla reportada) · `IN_MAINTENANCE` (En mantenimiento)
- `ReportStatus`: `REPORTED` (Reportado) → `ASSIGNED` (Asignado) → `IN_PROGRESS` (En proceso) → `RESOLVED` (Resuelto, estado final; no existe `CLOSED`). Además `REJECTED` (Rechazado: duplicado o falsa alarma), solo ADMIN.
- `ReportPriority`: `LOW` (Baja) · `MEDIUM` (Media) · `HIGH` (Alta)
- `FaultType`: `HARDWARE` (Daño físico) · `SOFTWARE` (Programas o sistema) · `CONNECTIVITY` (Conexión o red) · `POWER` (No enciende) · `OTHER` (Otro)
- `AssetType`: `COMPUTER` (Computadora) · `DISPLAY` (Pantalla) · `PROJECTOR` (Proyector) · `LAB_EQUIPMENT` (Equipo de laboratorio) · `OTHER` (Otro)

## Reglas de negocio importantes

1. **El estado del activo se deriva de sus reportes abiertos**, no se edita a mano: si hay alguno `IN_PROGRESS` → `IN_MAINTENANCE`; si no, y hay alguno `REPORTED`/`ASSIGNED` → `FAULT_REPORTED`; si no hay reportes abiertos → `OPERATIONAL`. Se recalcula con una sola función (`recomputeAssetStatus`) dentro de la misma transacción que cambia el reporte.
2. **Las transiciones de estado de un reporte viven en un solo módulo** (`server/reports/transitions`), con tests. Ningún componente ni ruta cambia `status` directamente.
3. **Cada cambio relevante crea un `ReportEvent`** en la misma transacción.
4. **Notificaciones:** reporte nuevo → todos los ADMIN; asignación → el técnico; reporte resuelto → los ADMIN. Canales: in-app (campana) y correo. Un fallo al enviar correo **nunca** debe impedir crear el reporte.
5. **El QR contiene solo una URL** (`{APP_URL}/a/{publicCode}`), no datos. Si `APP_URL` cambia, los QR impresos dejan de servir: fijar un dominio estable pronto.

## Stack (tentativo — por confirmar)

Elegido para un desarrollador solo con poco tiempo: un solo lenguaje y pocas piezas.

- **pnpm** — único gestor de paquetes (ver "Entorno seguro con pnpm").
- **Next.js (App Router) + TypeScript** — frontend y backend en un solo proyecto.
- **PostgreSQL + Prisma** — base de datos y ORM.
- **Better Auth** — correo/contraseña y roles. (Auth.js ya no es la opción recomendada para proyectos nuevos; verificar la documentación vigente antes de implementar.)
- **Tailwind CSS + shadcn/ui** — interfaz, enfoque mobile-first.
- **Zod** — validación de entradas en cliente y servidor.
- **`qrcode`** (npm) — generación de QR.
- **Resend o Nodemailer (SMTP)** — correo; decidir al llegar a esa fase.
- **Vitest** — pruebas unitarias y de integración (contra una PostgreSQL de pruebas distinta de la de desarrollo). **Playwright** — un E2E del flujo principal (Fase 11).
- **Despliegue:** Vercel + Postgres administrado (Neon o Supabase). Desarrollo y pruebas: PostgreSQL en Docker Compose (y Mailpit para ver correos, si se llega a la Fase 10).

No hace falta app nativa ni PWA en el MVP: la cámara del teléfono abre la URL del QR en el navegador.

Alternativas consideradas: Python (FastAPI) + React (menos experiencia del usuario, dos proyectos); Supabase para auth+BD (más rápido de arrancar, más acoplado a un proveedor).

## Estructura propuesta

```
src/
  app/
    a/[code]/               # ficha del activo (pública o staff según sesión)
    a/[code]/reportar/      # formulario de reporte (sin cuenta)
    login/
    (staff)/                # área autenticada
      reportes/  reportes/[id]/
      activos/   activos/[id]/qr/
      usuarios/
  server/
    auth/                   # sesión y permisos (can(user, action, resource))
    assets/  reports/       # servicios; reports/transitions.ts
    notifications/
    db.ts
  components/
  lib/                      # labels.ts, validators (zod), qr
prisma/  schema.prisma  seed.ts
tests/
```

## Comandos

*(Solo pnpm.)*

```bash
pnpm install --frozen-lockfile   # instalar respetando el lockfile
pnpm dev                         # servidor de desarrollo
pnpm build                       # build de producción
pnpm lint                        # lint
pnpm typecheck                   # tsc --noEmit
pnpm test                        # pruebas (Vitest)
pnpm test:watch                  # pruebas en modo observación
pnpm format                      # formato con Prettier
pnpm check                       # lint + typecheck + test: condición para cerrar cada fase
pnpm db:generate                 # regenerar el cliente de Prisma
pnpm db:migrate --name <nombre>  # migraciones en desarrollo
pnpm db:seed                     # datos de demostración
pnpm db:reset                    # BD desde cero: migraciones + seed (solo campusops_dev local)
pnpm db:studio                   # explorar la BD
sudo systemctl start docker      # iniciar Docker (no arranca solo)
sudo docker compose up -d --wait # PostgreSQL local (desarrollo y pruebas)
pnpm dlx <herramienta>           # herramientas puntuales (en lugar de npx)
```

## Entorno seguro con pnpm

- Usar **solo pnpm**: nunca `npm install` ni `yarn`. Fijar la versión en el campo `packageManager` de `package.json`. No se usa corepack: el pnpm del sistema (12.15.0) viene de pacman. Usar pnpm 11 o superior (`pnpm -v`); en versiones anteriores varios de los valores de abajo hay que activarlos a mano.
- **Node 26.13.1 (LTS)** fijado en `devEngines.runtime` y `.nvmrc`: pnpm lo descarga y lo usa en sus scripts, aunque el `node` del sistema sea otro.
- La configuración vive en `pnpm-workspace.yaml` y se commitea:
  - **Scripts de instalación de dependencias bloqueados**; solo se permiten los necesarios con `allowBuilds` (en pnpm 10.0–10.25 se llamaba `onlyBuiltDependencies`). Se aprueban con `pnpm approve-builds`, uno por uno, revisando qué hace cada paquete (típicamente Prisma y sus motores, `esbuild`, `sharp`).
  - `strictDepBuilds: true`: la instalación falla si hay un build script sin aprobar.
  - `minimumReleaseAge`: minutos que debe tener una versión publicada antes de instalarla (1440 = 1 día, el valor por defecto en pnpm 11). Excepciones solo con `minimumReleaseAgeExclude`, por un motivo escrito (p. ej. un parche de seguridad).
  - `blockExoticSubdeps: true`: bloquea dependencias transitivas que vengan de git o de tarballs directos.
  - Opcional: `trustPolicy: no-downgrade`.
- Nunca `dangerouslyAllowAllBuilds`, `--force` ni `--no-frozen-lockfile` en CI o despliegue.
- Commitear `pnpm-lock.yaml`. En CI y despliegue: `pnpm install --frozen-lockfile`.
- **Antes de agregar una dependencia, preguntar al usuario.** Revisar mantenimiento, descargas y si trae scripts de instalación. Preferir lo que ya está en el stack.
- `pnpm audit` al cerrar la Fase 11 y antes del despliegue.
- Verificar la documentación vigente de pnpm si alguna opción no existe en la versión instalada.

## Convenciones

- **Idioma:** código, nombres de variables, tablas y enums en inglés; textos de la interfaz, mensajes de error al usuario y documentación en español (México). **Los mensajes de commit van en inglés.**
- TypeScript en modo estricto; sin `any` salvo justificación en un comentario.
- La lógica de negocio va en `src/server/`, no en componentes. Los componentes solo muestran y llaman acciones.
- Mutaciones con Server Actions (o Route Handlers); toda entrada se valida con Zod en el servidor.
- **Diseño mobile-first:** el flujo de reporte se usa desde el celular al lado del equipo. Reportar debe tomar segundos: solo la descripción es obligatoria.
- **Interfaz:** antes de crear o rediseñar una pantalla, lee y aplica `.agents/skills/frontend-design/SKILL.md`. Si choca con este archivo, gana este archivo (mobile-first, Tailwind + shadcn/ui, textos en español, sin dependencias nuevas sin preguntar). Mantén una sola identidad visual en `src/app/globals.css`; no la reinventes en cada fase.
- Sin dependencias pesadas nuevas sin preguntar. Sin comentarios que repitan el código.
- **Claude no hace commits, `git push`, ramas ni PRs: los commits los hace siempre el usuario.** Al cerrar una fase deja los cambios sin commitear. Sí puede usar `git status` y `git diff` para revisar.
- **Al cerrar cada fase, Claude propone cómo dividir los commits** para evitar uno gigante:
  1. Corre `git status --short --untracked-files=all` y revisa qué cambió.
  2. Agrupa los archivos en commits pequeños, con un cambio lógico cada uno. Cada archivo va en un solo commit y ninguno queda fuera.
  3. Ordena los commits para que cada uno funcione por sí solo, y lo comprueba en una copia temporal con `pnpm check` y `pnpm build`, sin tocar el repositorio.
  4. Le da al usuario, por cada commit, un bloque listo para copiar con `git add <archivos>` y `git commit -m "<mensaje>"`. Las rutas con `[]` o `()` van entre comillas para que funcionen en zsh.
  5. Los mensajes van en inglés, con formato Conventional Commits (por ejemplo, `feat(auth): add login page`).
- **Pruebas:** la lógica de dominio (permisos, transiciones, estado derivado) se prueba con TDD o junto con el código; los servicios se prueban contra la BD de pruebas (`DATABASE_URL_TEST`), nunca la de desarrollo. La prueba de "no filtración" de la ficha pública debe seguir en verde en todas las fases.
- Antes de dar algo por terminado: `pnpm check` en verde y la prueba manual de la fase hecha de verdad en el navegador (idealmente desde un celular).

## Seguridad y privacidad

- `publicCode` aleatorio y no secuencial (p. ej. `nanoid`, ≥ 10 caracteres). Nunca exponer el id interno en el QR.
- **La ficha pública se filtra en el servidor**: para una persona sin sesión, los datos de staff (técnico, historial, serie, contacto de quien reportó) ni siquiera se envían al navegador. Ocultarlos solo con CSS o en el cliente no cuenta.
- **Autorización en cada acción del servidor** (Server Action / Route Handler / página), no solo en el middleware/proxy.
- Reporte sin cuenta: validar con Zod, límites de longitud, campo trampa (honeypot) y límite de reportes por IP y por activo (guardar hash de IP, no la IP). Evaluar captcha solo si hay abuso.
- Datos de contacto de quien reporta: opcionales, solo visibles para staff.
- Secretos solo en variables de entorno; mantener `.env.example` actualizado; usuarios de seed solo en desarrollo/demo.
- Privacidad y protección de datos personales: investigar con fuentes legales mexicanas vigentes; **no afirmar cumplimiento** en la documentación sin esa revisión.

## Fuera del MVP (no implementar sin preguntar)

Mantenimiento preventivo programado, costos de reparación, dashboard/analítica, fotos en reportes, mapa del campus, IoT (ESP32), IA/mantenimiento predictivo, multi-institución (SaaS multi-tenant), planes y facturación, integraciones con identidad institucional, notificaciones push/WhatsApp, registro abierto de usuarios, app nativa/PWA.

## Decisiones tomadas

- **Docker con `sudo` al usarlo:** el usuario no se agrega al grupo `docker`, que equivale a acceso de root. PostgreSQL solo escucha en `127.0.0.1`.
- **PostgreSQL 18.7** en desarrollo y pruebas, con las bases `campusops_dev` y `campusops_test`.
- **Build scripts:** solo `@prisma/engines` está aprobado, porque descarga el binario que ejecuta las migraciones. `prisma`, `esbuild`, `sharp` y `unrs-resolver` siguen bloqueados; todo funciona sin ellos.
- **Dependencias auxiliares aprobadas en la Fase 0:** `jsdom`, `@vitejs/plugin-react`, `eslint-config-prettier`, `prettier-plugin-tailwindcss` y lo que agrega shadcn/ui (preset `base-nova`). `shadcn` va en `devDependencies`.
- **Dependencias aprobadas en la Fase 1:** `@prisma/client`, `@prisma/adapter-pg`, `pg`, `nanoid`, `prisma`, `@types/pg`, `dotenv` y `tsx`. Las tres de Prisma van fijadas a la misma versión exacta.
- **Prisma 7:** la configuración vive en `prisma7.config.ts`, el cliente se genera en `src/generated/prisma` (no se versiona) y `postinstall` lo regenera.
- **`ReportStatus` sin `CLOSED`:** `RESOLVED` es el estado final.
- **Prioridad del reporte:** `LOW | MEDIUM | HIGH`, por defecto `MEDIUM`. La define el ADMIN, no quien reporta.
- **STAFF (Administrativo) es un rol propio** de solo lectura. El seed crea 1 ADMIN, 2 técnicos y 1 STAFF.
- **Varios reportes abiertos por activo:** se permiten. En la Fase 6 se avisa a quien reporta que ya hay uno abierto, sin bloquearlo.
- **Tipo de falla:** opcional, con las cinco opciones de `FaultType`.
- **Dependencias aprobadas en la Fase 2:** `better-auth` (versión exacta, incluye el adaptador de Prisma) y `zod`. No agregan build scripts.
- **Sesión:** dura 7 días y se renueva cada día. En equipos compartidos hay que cerrar sesión.
- **Login por el endpoint HTTP de Better Auth:** las llamadas internas `auth.api.*` no aplican el límite de intentos, así que el formulario de login no debe convertirse en Server Action.
- **Límite de intentos:** 5 por minuto por IP en `/sign-in/email`, guardado en la tabla `RateLimit`. Solo se activa en producción y depende de que el proxy de despliegue fije `X-Forwarded-For`: verificarlo en la Fase 12.
- **Usuarios inactivos:** no pueden iniciar sesión, y `getSession()` invalida de inmediato las sesiones que ya tenían abiertas.

## Decisiones abiertas

Preguntar al usuario cuando se llegue a ellas (la propuesta actual está en este archivo):

1. ¿Qué datos del equipo ve el público? (propuesta: tipo, marca, modelo, ubicación, especificaciones y estado; **no** serie ni inventario).
2. ¿Quien reporta recibe seguimiento por correo?
3. ¿Foto en el reporte? (propuesta: después del MVP).
4. Dominio/URL estable de despliegue (los QR dependen de él).

## Cómo trabajar en este proyecto

- El desarrollo avanza **por fases de `PLAN.md`, una fase por sesión**. Empieza leyendo `CLAUDE.md` y `PLAN.md`, trabaja solo la fase indicada y verifica que `pnpm check` pase antes de empezar.
- Al cerrar una fase: `pnpm check` en verde, "Listo cuando" cumplido y probado a mano, casillas marcadas en `PLAN.md`, "Estado actual" de este archivo actualizado y la propuesta de commits entregada (ver "Convenciones"). No adelantes la fase siguiente salvo que el usuario lo pida.
- Si el plan se atrasa, recorta según la sección "Recorte de alcance" de `PLAN.md`; **nunca** recortar el flujo central: QR → ficha → reporte → asignación → cambio de estado → historial.
- Ante una duda de producto, haz una pregunta concreta con opciones y una recomendación; no inventes reglas de negocio.
- Registra en este archivo cualquier decisión nueva y mueve su punto de "Decisiones abiertas" a la sección correspondiente.
