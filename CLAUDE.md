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

- Fase actual: **Fase 8 terminada (MVP funcional sin notificaciones). Siguiente: Fase 9 (Notificaciones in-app).**
- Última fase completada: Fase 8 (Técnico y ficha para personal).
- Verificado en la Fase 3: `pnpm check`, `pnpm build` y, sobre el build de producción en Chromium con tamaño de celular (320 y 390 px) y con la BD de pruebas, crear, editar y buscar activos y ubicaciones como ADMIN; TECHNICIAN, STAFF y anónimo quedan fuera sin recibir datos del inventario. Falta probar las Fases 2 y 3 en un celular físico.
- Verificado en la Fase 4: `pnpm check`, `pnpm build` y, sobre el build de producción servido en la red local, un celular físico escaneó el QR y abrió la ficha correcta. En Chromium (320 y 390 px): la ficha anónima no envía serie, inventario ni id interno (ni en el HTML ni en la respuesta cruda); los tres estados y los textos largos no desbordan; la etiqueta impresa (PDF) y la de pantalla se decodifican con zbar a la URL exacta; la etiqueta solo la ve el ADMIN.
- Verificado en la Fase 5: `pnpm check` (469 pruebas). Sin pantallas: el dominio se prueba con tablas de transiciones × rol (`tests/server/reports/`) y con integración contra la BD de pruebas (`tests/integration/reports.test.ts`): estado derivado, bitácora en orden, atomicidad (si falla el evento no cambia nada), permisos, conflicto entre la lectura y la escritura, y reportes simultáneos del mismo activo.
- Verificado en la Fase 6: `pnpm check` (503 pruebas), `pnpm build` y, sobre el build de producción con la BD de pruebas en Chromium (320 y 390 px): ficha → «Reportar falla» → error con descripción vacía → envío → folio → la ficha pasa a «Falla reportada»; aviso de reporte abierto; honeypot lleno no crea nada; el sexto reporte del mismo activo en una hora muestra el mensaje de límite; código inexistente → «No encontramos este equipo»; sin desbordes y sin datos de staff en el HTML; en la BD queda el hash de la IP, no la IP. Las pruebas de envíos simultáneos fallan si se quita el bloqueo. Con un celular físico en la red local: se escaneó el QR, se envió un reporte anónimo y el activo pasó a «Falla reportada», con su evento y el hash de la IP.
- Verificado en la Fase 7: `pnpm check` (579 pruebas), `pnpm build` y, sobre el build de producción con la BD de desarrollo en Chromium (320 y 390 px): un anónimo reporta dos fallas; como ADMIN aparecen en la bandeja «Sin asignar», se asigna un técnico, se sube la prioridad a Alta (repetir la misma prioridad da mensaje) y se rechaza el duplicado (sin motivo pide el motivo); la bitácora muestra creado → asignado → prioridad en orden. Filtros por estado, técnico y equipo, y parámetros inválidos sin error. STAFF ve bandeja y detalle sin formularios; el técnico asignado ve solo su reporte; el otro técnico recibe «No encontramos este reporte»; sin sesión, `/reportes/[id]` manda a `/login`; la ficha pública no muestra al técnico. Sin desbordes. Ojo: al probar varios perfiles seguidos se alcanza el límite de 5 inicios de sesión por minuto.
- Verificado en la Fase 8: `pnpm check` (656 pruebas), `pnpm build` y, sobre el build de producción con la BD de desarrollo en Chromium (320 y 390 px), con tres perfiles: el anónimo reporta (la ficha pasa a «Falla reportada») → el ADMIN asigna a Técnico Demo 1 (la ficha de staff muestra el técnico y la etapa «Asignado») → el técnico entra a `/mis-reportes` (también desde `/reportes`, que lo redirige), ve el reporte en «Por iniciar», lo pasa a en proceso con nota (la ficha pasa a «En mantenimiento»), deja una nota, resolver sin nota pide la nota y con nota lo cierra (la ficha vuelve a «Funcionando») y el reporte pasa a «Cerrados recientemente» → STAFF abre la ficha y ve inventario, serie e historial con técnico y nota de cierre; la bitácora queda creado → asignado → en proceso → nota → resuelto y no ve formularios. Otro técnico ve el historial del equipo sin enlaces a reportes ajenos. El HTML anónimo no trae inventario, serie, técnico, notas ni historial. Sin desbordes. Falta repetir la prueba con un celular físico.
- Prueba con celular en la red local: `APP_URL=http://<IP-de-la-laptop>:<puerto>`, `pnpm build` y `next start -H 0.0.0.0`. El firewall (ufw) bloquea la entrada: abrir el puerto solo para la red local (`sudo ufw allow from 192.168.1.0/24 to any port <puerto> proto tcp`) y cerrarlo al terminar. Brave en Android falló con `ERR_TOO_MANY_RETRIES` (forzaba HTTPS); con otro navegador funcionó.
- Para correr `pnpm check` y `pnpm build` hacen falta PostgreSQL arriba y un `.env` copiado de `.env.example` con `BETTER_AUTH_SECRET` e `IP_HASH_SECRET`.
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
| Definir la prioridad de un reporte | ❌ | ❌ | ❌ | ✅ |
| Cambiar estado de un reporte | ❌ | ❌ | Solo los suyos | ✅ |
| Agregar notas a un reporte abierto | ❌ | ❌ | Solo los suyos | ✅ |
| Rechazar un reporte | ❌ | ❌ | ❌ | ✅ |
| Crear/editar activos y generar QR | ❌ | ❌ | ❌ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ❌ | ✅ |

En código los roles son `ADMIN`, `TECHNICIAN` (Técnico) y `STAFF` (Administrativo); en la interfaz y en la documentación se usan sus nombres en español. No hay registro abierto: los usuarios con cuenta los crea el ADMIN (o el seed en desarrollo).

## Modelo de dominio (propuesta)

- **User** — nombre, correo, `emailVerified`, imagen opcional, rol (`ADMIN | TECHNICIAN | STAFF`), activo/inactivo. Lo gestiona la librería de auth.
- **Location** — edificio y aula/laboratorio.
- **Asset** — `publicCode` (aleatorio, va en el QR), número de inventario, nombre, tipo, marca, modelo, número de serie, especificaciones, ubicación, `status`.
- **Report** — `folio` autoincremental (el que ve quien reporta), activo, descripción, tipo de falla opcional, prioridad (por defecto `MEDIUM`; la define el ADMIN, no quien reporta), `status`, contacto opcional de quien reporta, hash de IP (`reporterIpHash`, para el límite de uso), técnico asignado, fechas, nota de resolución.
- **ReportEvent** — bitácora de cada reporte (creado, asignado, cambio de estado, cambio de prioridad, comentario) con actor, estado anterior y nuevo, mensaje, técnico asignado (`assigneeId`, solo en asignaciones), prioridad nueva (`priority`, solo en cambios de prioridad) y fecha. Es lo que alimenta "en qué parte del proceso está" y el historial.
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
      reportes/  reportes/[id]/  mis-reportes/
      activos/   activos/nuevo/   activos/[id]/editar/   activos/[id]/qr/
      ubicaciones/
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
- **Pantallas sin permiso:** quien tiene sesión pero no el permiso se redirige a `/reportes`; sin sesión, a `/login`. El técnico que llega a `/reportes` (incluso tras el login) pasa a `/mis-reportes`, y el ADMIN o STAFF que entra a `/mis-reportes` pasa a `/reportes`.
- **Activos y ubicaciones no se borran en el MVP:** el plan solo pide listar, ver, crear y editar.
- **Búsqueda de activos:** ignora mayúsculas y exige todas las palabras, pero distingue acentos (`computo` no encuentra `Cómputo`).
- **Identidad visual (Fase 3):** la placa metálica de inventario. Tokens en `src/app/globals.css`, tipografías Barlow y Barlow Condensed con `next/font` (sin dependencias nuevas) y la clase `.asset-plate` para el número de inventario.
- **Datos públicos del activo (Fase 4):** nombre, tipo, marca, modelo, ubicación (edificio y aula), especificaciones y estado. **No** serie, inventario ni id interno. La lista vive en `publicAssetSelect` (`src/server/assets/view.ts`) y la prueba de no filtración (`tests/integration/asset-view.test.ts`) exige exactamente esos campos.
- **Etiqueta QR:** imprime nombre, ubicación y el `publicCode` (no el número de inventario, porque queda a la vista de cualquiera). Mide 70 mm de ancho al imprimir.
- **Código inexistente en `/a/[code]`:** muestra la pantalla "No encontramos este equipo" con `noindex`, pero el HTTP queda en 200. Con Cache Components la respuesta empieza antes de consultar la BD; un 404 HTTP real exigiría un `proxy.ts` con consulta a la BD, y se descartó. Los códigos con formato inválido se rechazan sin consultar la BD.
- **Transiciones (Fase 5):** flujo lineal estricto `REPORTED → ASSIGNED → IN_PROGRESS → RESOLVED`; no se resuelve directo desde `ASSIGNED` y no se reabre un reporte cerrado. `REJECTED` desde cualquier estado abierto, solo ADMIN (acción `report:reject`). Iniciar y resolver: ADMIN o el técnico asignado. La tabla vive en `src/server/reports/transitions.ts`; el permiso se revisa antes que el estado.
- **Reasignar técnico:** el ADMIN puede cambiar el técnico en `ASSIGNED` o `IN_PROGRESS`; el estado se conserva. No se reasigna al mismo técnico. Solo se asigna a usuarios `TECHNICIAN` activos. El técnico anterior pierde acceso al reporte.
- **Bitácora de asignaciones:** `ReportEvent.assigneeId` (migración `add_report_event_assignee`) guarda a quién se asignó en cada asignación o reasignación.
- **Notas:** resolver exige nota (`resolutionNote` y mensaje del evento, `resolvedAt`). Rechazar exige motivo, que se guarda en `resolutionNote` y en el mensaje del evento (`resolvedAt` queda vacío). Iniciar admite una nota opcional.
- **Servicios de reportes (`src/server/reports/service.ts`):** `createReport(viewer, publicCode, input, { reporterIpHash })` recibe el código público, nunca el id interno; el hash de IP lo pone el servidor. La entrada inválida vuelve como `fieldErrors`; lo demás se lanza: `AuthorizationError` o una subclase de `ReportDomainError` (`ReportNotFoundError`, `AssetNotFoundError`, `InvalidTransitionError`, `InvalidAssigneeError`, `ReportConflictError`, `ReportRateLimitError`, `UnchangedPriorityError`) con mensaje en español listo para mostrar. Los demás servicios: `assignReport`, `changeReportStatus`, `rejectReport` y `setReportPriority`.
- **Concurrencia:** cada cambio actualiza el reporte solo si su estado y técnico siguen como se leyeron (si no, `ReportConflictError`). `recomputeAssetStatus` bloquea la fila del activo (`FOR NO KEY UPDATE`) para que dos transacciones no dejen un estado viejo.
- **Reporte público (Fase 6):** `/a/[code]/reportar` con la Server Action `submitReportAction` (`src/server/reports/actions.ts`). Solo la descripción es obligatoria; el tipo de falla se elige con botones y empieza en «No sé» (se guarda `null`). La confirmación muestra el folio en la misma pantalla. El aviso de reporte abierto sale del estado público del activo (`FAULT_REPORTED` / `IN_MAINTENANCE`), sin exponer los reportes, y se oculta tras enviar.
- **Seguimiento a quien reporta:** no en el MVP. Nombre y correo son opcionales y solo sirven para que el personal lo contacte; el folio se muestra en pantalla.
- **Anti-abuso (Fase 6):** campo trampa `website` (si llega lleno, error genérico sin crear nada) y límites solo para anónimos, en una ventana de 1 hora: 10 reportes por IP (alto porque en el wifi del campus muchos comparten IP) y 5 por activo (de cualquier IP, incluidos los del personal). Viven en `src/server/reports/rate-limit.ts` y se revisan dentro de la transacción de `createReport`, con un candado por IP (`pg_advisory_xact_lock`) y la fila del activo bloqueada para que los envíos simultáneos no rebasen el tope. Quien tiene sesión no tiene límite y no se guarda su IP. Sin IP conocida solo aplica el límite por activo.
- **IP de quien reporta:** se toma del primer salto de `X-Forwarded-For` (o `X-Real-IP`) en `src/server/client-ip.ts` y se guarda solo como HMAC-SHA256 con `IP_HASH_SECRET` (variable obligatoria, distinta de `BETTER_AUTH_SECRET`). Sin un proxy que fije el encabezado, el cliente puede inventarlo: verificarlo en la Fase 12, igual que el límite de login. Las IPv6 se cuentan por dirección completa, no por prefijo /64.
- **Cada página de `(staff)` lleva su propio `loading.tsx`** (una línea que reexporta `StaffLoading` de `src/components/staff/staff-loading.tsx`). Con Cache Components, Next valida en desarrollo que la navegación entre páginas sea instantánea: el `Suspense` del layout de `(staff)` no la cubre, porque el layout compartido no se vuelve a pintar, y un `loading.tsx` en la carpeta del grupo tampoco, porque envuelve también a ese layout. Sin él, `pnpm dev` muestra «Next.js encountered uncached data…». Las páginas nuevas (`/reportes/[id]`, `/mis-reportes`, `/usuarios`) deben agregarlo.
- **Prioridad (Fase 7):** el ADMIN la cambia solo en reportes abiertos (acción `report:setPriority`, operación `prioritize` en `transitions.ts`, que no mueve el estado). Cada cambio deja un evento `PRIORITY_CHANGED` con la prioridad nueva en `ReportEvent.priority` (migración `add_report_priority_event`). Repetir la prioridad actual se rechaza sin crear evento (`UnchangedPriorityError`).
- **Bandeja `/reportes` (Fase 7):** por defecto muestra los abiertos (Reportado, Asignado, En proceso), del folio más reciente al más antiguo, 20 por página. Filtros en la URL: `estado` (un estado o `todos`), `q` (texto del equipo: nombre, inventario, marca, modelo, serie o ubicación, con la misma regla que `/activos`), `tecnico` (id o `sin-asignar`) y `pagina`. Un valor inválido vuelve al valor por defecto. ADMIN y STAFF ven todos; el técnico solo los suyos y no tiene filtro de técnico. Los reportes de prioridad alta llevan una franja amarilla.
- **Detalle `/reportes/[id]` (Fase 7):** un reporte que no existe o que el usuario no puede ver da la misma pantalla «No encontramos este reporte». Las acciones del ADMIN (asignar, prioridad, rechazar) salen de `allowedOperations`, viven en `src/server/reports/actions.ts` y al terminar vuelven al detalle con `?aviso=asignado|prioridad|rechazado`. El rechazo pide confirmar con el motivo en un segundo paso. Las consultas de lectura viven en `src/server/reports/queries.ts` y nunca seleccionan `reporterIpHash`. Las fechas se muestran en la hora de `America/Mexico_City` (`src/lib/dates.ts`).
- **Navegación de staff:** `staffNavItems` (`src/components/staff/nav-items.ts`) arma las secciones con `can()`: ADMIN y STAFF ven Reportes y el técnico ve Mis reportes (`canViewAllReports` en `permissions.ts`); solo el ADMIN ve Activos y Ubicaciones.
- **Notas en reportes (Fase 8):** el técnico asignado y el ADMIN dejan notas sueltas en reportes abiertos (acción `report:comment`, operación `comment` en `transitions.ts`, servicio `addReportComment`). Cada nota es un evento `COMMENT` («Nota» en la bitácora) que no cambia el estado. STAFF no deja notas. Siguen la nota opcional al iniciar y la obligatoria al resolver.
- **`/mis-reportes` (Fase 8):** pantalla de trabajo del técnico (`listMyReports` en `queries.ts`): «En proceso», «Por iniciar» (prioridad alta primero en cada grupo) y los 10 cerrados (resueltos o rechazados) más recientes. Iniciar, anotar y resolver se hacen en `/reportes/[id]`, que muestra «Avance del trabajo» según `allowedOperations` (el ADMIN también lo ve) y vuelve con `?aviso=en-proceso|resuelto|nota`. El estado destino lo fija la acción (`startReportAction`, `resolveReportAction`), no el formulario.
- **Ficha de staff (Fase 8):** `getAssetView` devuelve el DTO público sin cambios a anónimos y cuentas inactivas, y a quien tiene `asset:viewStaffDetails` le agrega un objeto `staff` (`isStaffAssetView`): inventario, serie, reportes abiertos con etapa y técnico, los últimos 10 reportes del equipo (abiertos y cerrados) con falla y nota de cierre, y el total. Nunca trae el contacto ni el hash de IP de quien reportó. Cada reporte trae `detailId` solo si quien mira puede abrir el detalle (el técnico, solo los suyos). La ficha enlaza de vuelta a Reportes o Mis reportes y, si hay más de 10, a la bandeja filtrada por el inventario.
- **Dependencias aprobadas en la Fase 4:** `qrcode` 1.5.4 y `@types/qrcode` 1.5.6 (versiones exactas, sin build scripts). El QR se genera como SVG en el servidor, con corrección de errores M.

## Decisiones abiertas

Preguntar al usuario cuando se llegue a ellas (la propuesta actual está en este archivo):

1. ¿Foto en el reporte? (propuesta: después del MVP).
2. Dominio/URL estable de despliegue (los QR dependen de él).

## Cómo trabajar en este proyecto

- El desarrollo avanza **por fases de `PLAN.md`, una fase por sesión**. Empieza leyendo `CLAUDE.md` y `PLAN.md`, trabaja solo la fase indicada y verifica que `pnpm check` pase antes de empezar.
- Al cerrar una fase: `pnpm check` en verde, "Listo cuando" cumplido y probado a mano, casillas marcadas en `PLAN.md`, "Estado actual" de este archivo actualizado y la propuesta de commits entregada (ver "Convenciones"). No adelantes la fase siguiente salvo que el usuario lo pida.
- Si el plan se atrasa, recorta según la sección "Recorte de alcance" de `PLAN.md`; **nunca** recortar el flujo central: QR → ficha → reporte → asignación → cambio de estado → historial.
- Ante una duda de producto, haz una pregunta concreta con opciones y una recomendación; no inventes reglas de negocio.
- Registra en este archivo cualquier decisión nueva y mueve su punto de "Decisiones abiertas" a la sección correspondiente.
