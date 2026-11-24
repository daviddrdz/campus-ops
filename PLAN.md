# CampusOps — PLAN.md

> Borrador. Nada es final; ajusta fases, tecnologías y alcance según avances.
> Convenciones, reglas de negocio, seguridad con pnpm y decisiones abiertas: ver `CLAUDE.md`.
> Contexto: desarrollo individual, ~1 semana, ~4–6 h útiles por día.

## 1. Objetivo del MVP

Demostrar el flujo completo, de punta a punta, con datos de ejemplo:

**QR → ficha del activo → reporte de falla → notificación al administrador → asignación a técnico → avance y resolución → historial visible para el personal administrativo.**

## 2. Cómo usar este plan

Cada fase está pensada para **una sesión de Claude Code**: tiene alcance acotado, pruebas propias y un criterio de "Listo cuando". Las fases se hacen en orden; cada una deja el proyecto en un estado que compila, pasa las pruebas y se puede probar a mano.

### Reglas para todas las sesiones

1. Abre una sesión nueva por fase y empieza con el prompt de abajo.
2. **Antes de codificar**, comprueba que la fase anterior esté cerrada: `pnpm check` en verde. Si no lo está, arréglalo primero.
3. Escribe las pruebas junto con el código (en la lógica de dominio, antes del código).
4. **Una fase termina solo cuando** `pnpm check` (= lint + typecheck + test) está en verde **y** se cumple su "Listo cuando", incluida la prueba manual.
5. Al cerrar: marca las casillas de esta fase, actualiza la sección "Estado actual" de `CLAUDE.md` y anota cualquier decisión nueva. **No hagas commits**: los hace el usuario. Deja los cambios sin commitear, revisa `git status` y propón qué archivos van en cada commit, con su mensaje en inglés (ver "Convenciones" en `CLAUDE.md`).
6. No empieces la siguiente fase en la misma sesión (a menos que lo pidas): mantiene el contexto pequeño y el trabajo revisable.
7. Solo **pnpm**. Sin `npm`/`yarn`, sin `--force`, sin permitir todos los build scripts. Dependencia nueva = preguntar primero (ver `CLAUDE.md`, "Entorno seguro con pnpm").
8. Si una decisión abierta bloquea la fase, haz una pregunta concreta con opciones y una recomendación.

### Prompt de arranque (cópialo y cambia el número)

> Lee `CLAUDE.md` y `PLAN.md`. Trabaja **solo la Fase N**. Verifica primero que `pnpm check` pase. Al terminar, corre `pnpm check`, haz la prueba manual descrita, marca las casillas de la fase en `PLAN.md` y actualiza "Estado actual" en `CLAUDE.md`. Si algo no está claro, pregúntame antes de asumir. No hagas commits ni `git push`: los commits los hago yo.

## 3. Resumen de fases

| # | Fase | Resultado que se puede probar | Esfuerzo | Recortable |
|---|---|---|:-:|:-:|
| 0 | Andamiaje y entorno seguro | `pnpm check` y `pnpm build` en verde; app arranca; Postgres en Docker | M | No |
| 1 | Base de datos y seed | Migraciones y seed desde cero; pruebas de integración contra BD de prueba | M | No |
| 2 | Autenticación y permisos | Login con cada rol; matriz de permisos probada | L | No |
| 3 | Activos y ubicaciones (ADMIN) | CRUD de activos con `publicCode` único | M | No |
| 4 | QR y ficha pública | Escaneo con celular abre la ficha; la vista pública no filtra datos de staff | M | No |
| 5 | Dominio de reportes (sin UI) | Transiciones y estado derivado del activo, probados | L | No |
| 6 | Reporte público (formulario + anti-abuso) | Reporte anónimo desde el celular crea reporte y cambia el estado | M | Parcial |
| 7 | Bandeja de reportes y asignación | ADMIN ve la bandeja, asigna técnico o rechaza | M | No |
| 8 | Técnico y ficha para personal | Flujo completo con tres roles; ficha de staff con historial | L | No |
| 9 | Notificaciones in-app | Campana con notificaciones correctas por rol | M | No |
| 10 | Correo electrónico | Correos de reporte nuevo y asignación; fallos no rompen el flujo | S | **Sí (primero)** |
| 11 | Seguridad, QA y E2E | Matriz de permisos automatizada, auditoría, E2E del flujo principal | L | E2E sí |
| 12 | Despliegue y demo | App en producción con URL estable; demo ensayada | M | No |

Esfuerzo: S ≈ 1 h · M ≈ 1.5–2 h · L ≈ 2–3 h.

### Calendario sugerido (13 sesiones en 7 días)

| Día | Sesiones |
|---|---|
| 1 | Fase 0, Fase 1 |
| 2 | Fase 2, Fase 3 |
| 3 | Fase 4, Fase 5 |
| 4 | Fase 6, Fase 7 |
| 5 | Fase 8, Fase 9 |
| 6 | Fase 10, Fase 11 |
| 7 | Fase 12 + colchón para imprevistos |

Si vas justo de tiempo: fusiona Fase 0 + 1 y Fase 9 + 10, y aplica el recorte de la sección 6.

### Estado de las fases

- [x] Fase 0  - [x] Fase 1  - [x] Fase 2  - [x] Fase 3  - [x] Fase 4  - [x] Fase 5  - [x] Fase 6
- [ ] Fase 7  - [ ] Fase 8  - [ ] Fase 9  - [ ] Fase 10  - [ ] Fase 11  - [ ] Fase 12

## 4. Estrategia de pruebas

| Tipo | Herramienta | Qué cubre |
|---|---|---|
| Unitarias | Vitest | Funciones puras: permisos `can()`, transiciones, validadores Zod, generador de `publicCode`, armado de URL del QR. |
| Integración | Vitest + PostgreSQL de prueba | Servicios con base de datos real: crear/asignar/resolver reportes, estado derivado, notificaciones, límites de uso. |
| Componentes | Vitest + Testing Library | Lo mínimo: formularios clave y estados visibles. |
| E2E | Playwright | Un solo flujo principal (Fase 11). |
| Manuales | Navegador y **celular real** | Cada fase trae su prueba manual; el QR se prueba siempre con celular. |

Reglas:
- La **base de datos de pruebas es distinta** de la de desarrollo (`DATABASE_URL_TEST`). Las pruebas la limpian por su cuenta; nunca tocan la de desarrollo.
- Las pruebas de integración usan la capa de servicios, no la interfaz.
- Hay una **prueba de "no filtración"** de la ficha pública (Fase 4) que se mantiene en verde en todas las fases siguientes.
- Un script `pnpm check` ejecuta lint + typecheck + tests y es la condición para cerrar cada fase.

## 5. Fases

### Fase 0 — Andamiaje y entorno seguro
**Objetivo:** proyecto vacío pero sólido, con pnpm configurado de forma segura y pruebas funcionando.
**Depende de:** nada.

**Tareas**
- [x] Verificar Node LTS y pnpm (`pnpm -v`; usar pnpm 11 o superior). Fijar pnpm en `packageManager` y Node 26.13.1 en `devEngines.runtime`. Sin corepack (ver `CLAUDE.md`).
- [x] Crear el proyecto con `pnpm create next-app` (TypeScript, App Router, Tailwind, ESLint, carpeta `src`, alias `@/*`).
- [x] `pnpm-workspace.yaml` con la configuración de seguridad de `CLAUDE.md` (scripts de build bloqueados salvo lista aprobada, `strictDepBuilds`, `minimumReleaseAge`, `blockExoticSubdeps`). Aprobar solo lo necesario con `pnpm approve-builds`.
- [x] shadcn/ui, Prettier, `.gitignore`, `.env.example`, `.nvmrc`.
- [x] Vitest + Testing Library. Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `check`.
- [x] `docker-compose.yml` con PostgreSQL (BD de desarrollo y de pruebas).
- [x] Página de inicio provisional y ruta `GET /api/health`.
- [x] Si no existe, inicializar el repositorio Git (`git init`) y dejar el `.gitignore` listo. **El primer commit lo hace el usuario.**

**Pruebas**
- Automática: prueba de humo del handler de `/api/health` y de una función utilitaria; `pnpm check` en verde.
- Manual: `pnpm dev` abre la página; `pnpm build` termina; en una carpeta limpia `pnpm install --frozen-lockfile` funciona; `sudo docker compose up -d --wait` deja Postgres aceptando conexiones.

**Listo cuando:** `pnpm check` y `pnpm build` pasan en limpio, el lockfile está commiteado y no hay scripts de build sin aprobar.

---

### Fase 1 — Base de datos y seed
**Objetivo:** modelo de datos completo, migración inicial, datos de ejemplo y BD de pruebas funcionando.
**Depende de:** Fase 0.

**Tareas**
- [x] Instalar y configurar Prisma siguiendo la guía vigente para Next.js + PostgreSQL (la v7 cambió la configuración; revisar la documentación antes de escribir código).
- [x] `schema.prisma`: `User` (con los campos que exige la librería de auth y `role`), `Location`, `Asset` (`publicCode` único), `Report` (`folio` autoincremental, `reporterIpHash`, contacto opcional, prioridad `LOW | MEDIUM | HIGH`), `ReportEvent`, `Notification`; enums de estados y roles (nombres en inglés), sin `CLOSED`.
- [x] Primera migración.
- [x] `lib/public-code.ts`: generador de `publicCode` (aleatorio, no secuencial, ≥ 10 caracteres).
- [x] `lib/labels.ts`: etiquetas en español para estados y roles.
- [x] Seed idempotente: 4 usuarios (sin credenciales aún), 3–4 ubicaciones, ~6 activos de ejemplo.
- [x] Scripts: `db:migrate`, `db:seed`, `db:reset`, `db:studio`.
- [x] Configuración de pruebas de integración: BD de pruebas, migración automática antes de la suite y helper `resetDb()`.

**Pruebas**
- Unitarias: `generatePublicCode()` (longitud, alfabeto, sin colisiones en 10 000 muestras); `labels` cubre todos los valores de cada enum.
- Integración: `publicCode` único; un activo exige ubicación; no se puede borrar un activo con reportes; `ReportEvent` se ordena por fecha; el seed se puede correr dos veces sin duplicar.
- Manual: `pnpm db:reset` desde cero y revisar los datos con `pnpm db:studio`.

**Listo cuando:** `pnpm db:reset` funciona desde una BD vacía y las pruebas de integración corren contra la BD de pruebas.

---

### Fase 2 — Autenticación y permisos
**Objetivo:** iniciar sesión con roles y una función central de permisos.
**Depende de:** Fase 1.

**Tareas**
- [x] Better Auth con correo/contraseña y adaptador de Prisma; verificar la documentación vigente antes de implementar. Agregar al esquema las tablas que pida (sesión, cuenta, verificación, límite de intentos).
- [x] Campo `role` en el usuario. **Registro abierto deshabilitado.**
- [x] El seed crea las credenciales de los 4 usuarios de desarrollo (contraseñas solo para desarrollo, documentadas en el README).
- [x] `server/auth/permissions.ts`: `can(user, action, resource?)` como función pura con la matriz de `CLAUDE.md`.
- [x] Helpers `getSession()` y `requireRole()` para páginas y acciones del servidor.
- [x] `/login`, cierre de sesión y layout del área `(staff)` con nombre y rol; redirige si no hay sesión.
- [x] Si la autenticación consume más de ~2 h, simplificar: sin recuperación de contraseña ni OAuth.

**Pruebas**
- Unitarias: matriz completa de `can()` en una tabla (cada rol × cada acción, incluido anónimo).
- Integración: login correcto e incorrecto; el endpoint de registro rechaza solicitudes; `requireRole` lanza error con un rol no permitido; un usuario inactivo no puede iniciar sesión.
- Manual: entrar con cada uno de los 4 usuarios y ver su rol; entrar a `(staff)` sin sesión redirige a `/login`.

**Listo cuando:** los 4 usuarios (3 roles) inician sesión, la ruta protegida redirige a anónimos y la matriz de permisos tiene pruebas para todas las combinaciones.

---

### Fase 3 — Activos y ubicaciones (ADMIN)
**Objetivo:** el ADMIN administra el inventario.
**Depende de:** Fase 2.

**Tareas**
- [x] Servicios `assets` y `locations` (listar, ver, crear, editar) con validadores Zod.
- [x] Server Actions con `can()` en cada una.
- [x] `publicCode` generado en el servidor al crear, con reintento si hay colisión; **no cambia al editar**.
- [x] Pantallas `/activos` (lista con búsqueda simple), `/activos/nuevo`, `/activos/[id]/editar`; ubicaciones en una pantalla sencilla.

**Pruebas**
- Unitarias: validadores (campos obligatorios, longitudes, tipo de activo válido).
- Integración: crear activo genera `publicCode` único; editar no cambia `publicCode`; un usuario que no es ADMIN no puede crear ni editar; lista filtra por texto.
- Manual: crear, editar y buscar activos desde el navegador como ADMIN; confirmar que un TECHNICIAN no ve el menú ni puede entrar a `/activos`.

**Listo cuando:** el ADMIN gestiona activos y ubicaciones y los demás roles quedan fuera.

---

### Fase 4 — QR y ficha pública
**Objetivo:** escanear un QR abre la ficha correcta, con el filtrado de datos bien hecho desde el inicio.
**Depende de:** Fase 3.

**Tareas**
- [x] `lib/qr.ts`: `buildAssetUrl(code)` con `APP_URL` y generación del QR (SVG o PNG) con la librería `qrcode`.
- [x] `/activos/[id]/qr`: QR + etiqueta imprimible (nombre, ubicación, código) con estilos de impresión.
- [x] `/a/[code]`: ficha del activo. `getAssetView(code, viewer)` devuelve un DTO **con lista explícita de campos**: el DTO público trae nombre, tipo, marca, modelo, ubicación, especificaciones y estado; el DTO de staff queda como punto de extensión para la Fase 8.
- [x] Código desconocido → pantalla 404 con `noindex` (HTTP 200 por Cache Components; ver `CLAUDE.md`); etiqueta de estado con color y texto; botón "Reportar falla" (enlace a la Fase 6).
- [x] Diseño mobile-first.

**Pruebas**
- Unitarias: `buildAssetUrl` con y sin barra final en `APP_URL`; el QR generado codifica exactamente esa URL.
- **Prueba de no filtración:** el DTO público contiene únicamente los campos de la lista permitida (serie, inventario, técnico, historial y contacto nunca aparecen). Esta prueba se mantiene hasta el final del proyecto.
- Integración / componente: código inexistente → 404; la página renderizada para un anónimo no contiene el número de serie.
- Manual: abrir la app desde el celular en la misma red (`pnpm dev -H 0.0.0.0` y `APP_URL` con la IP de la laptop), escanear el QR en pantalla o impreso y ver la ficha correcta.

**Listo cuando:** el celular escanea un QR y abre la ficha del activo correcto, y la prueba de no filtración está en verde.

---

### Fase 5 — Dominio de reportes (sin interfaz)
**Objetivo:** toda la lógica de reportes lista y probada antes de construir pantallas. Es la fase con más pruebas.
**Depende de:** Fase 1 (y Fase 2 para los permisos).

**Tareas**
- [x] `server/reports/transitions.ts`: transiciones permitidas (`REPORTED → ASSIGNED → IN_PROGRESS → RESOLVED`, y `REJECTED` desde estados abiertos) y qué rol puede ejecutarlas. Funciones puras.
- [x] `recomputeAssetStatus(tx, assetId)` según las reglas de `CLAUDE.md`.
- [x] Servicios en transacción: `createReport`, `assignReport`, `changeReportStatus`, `rejectReport`. Cada uno crea su `ReportEvent` y recalcula el estado del activo.
- [x] Errores tipados (transición inválida, sin permiso, reporte no encontrado).
- [x] Resolver exige nota de resolución.

**Pruebas**
- Unitarias (tabla): cada transición válida e inválida × rol.
- Integración — estado derivado: sin reportes → `OPERATIONAL`; uno `REPORTED` → `FAULT_REPORTED`; `ASSIGNED` mantiene `FAULT_REPORTED`; `IN_PROGRESS` → `IN_MAINTENANCE`; dos reportes mezclados; resolver uno con otro abierto; rechazar el único abierto.
- Integración — eventos: cada acción deja el `ReportEvent` correcto y en orden.
- Integración — atomicidad: si falla la creación del evento, el estado del reporte y del activo no cambia.
- Integración — permisos: un TECHNICIAN no puede cambiar reportes ajenos ni asignar; solo ADMIN asigna y rechaza.

**Listo cuando:** todo el dominio está probado sin una sola pantalla y `pnpm check` está en verde.

---

### Fase 6 — Reporte público (formulario y anti-abuso)
**Objetivo:** cualquier persona reporta una falla desde el celular, sin cuenta.
**Depende de:** Fases 4 y 5.

**Tareas**
- [x] `/a/[code]/reportar`: descripción (obligatoria), tipo de falla (opciones rápidas), nombre y correo opcionales. Pensado para completarse en segundos.
- [x] Server Action `submitReport` con validación Zod.
- [x] Anti-abuso: campo trampa (honeypot) y límite de reportes por IP y por activo en una ventana de tiempo (guardar solo el hash de la IP con un secreto de entorno).
- [x] Pantalla de confirmación con el folio.
- [x] Si el activo ya tiene un reporte abierto, avisar a quien reporta sin bloquearlo.
- [ ] Opcional: primer despliegue de vista previa para probar con datos móviles. *(No se hizo: el dominio y el proveedor se deciden en la Fase 12.)*

**Pruebas**
- Unitarias: validador (vacío, demasiado largo, correo mal formado); hash de IP estable y no reversible a simple vista.
- Integración: un anónimo crea reporte, evento y estado `FAULT_REPORTED`; honeypot lleno → se rechaza sin crear nada; superar el límite → error claro; código de activo inexistente → error.
- Manual: reportar desde el celular escaneando el QR y ver la ficha actualizada con "Falla reportada".

**Listo cuando:** un reporte anónimo desde el celular crea el reporte y el activo cambia de estado.

---

### Fase 7 — Bandeja de reportes y asignación
**Objetivo:** el administrador de reportes ve, asigna y rechaza.
**Depende de:** Fase 6.

**Tareas**
- [ ] `/reportes`: lista con filtros por estado, activo y técnico; paginación simple. ADMIN ve todos, STAFF ve todos en solo lectura.
- [ ] `/reportes/[id]`: detalle con línea de tiempo de eventos.
- [ ] Asignar técnico (solo técnicos activos), definir la prioridad y rechazar con motivo (solo ADMIN).
- [ ] Navegación del área staff según el rol.

**Pruebas**
- Integración: la lista respeta el rol (ADMIN y STAFF todos; TECHNICIAN solo los suyos); los filtros funcionan; asignar a un usuario que no es técnico se rechaza; STAFF no puede asignar.
- Componente: la línea de tiempo muestra los eventos en orden.
- Manual: con el reporte de la fase anterior, entrar como ADMIN, asignarlo y ver el evento en la línea de tiempo.

**Listo cuando:** el ADMIN puede tomar un reporte nuevo y asignarlo o rechazarlo, y todo queda en la bitácora.

---

### Fase 8 — Técnico y ficha para personal
**Objetivo:** cerrar el flujo completo con los tres roles. **Hito: MVP funcional sin notificaciones.**
**Depende de:** Fase 7.

**Tareas**
- [ ] `/mis-reportes` para TECHNICIAN: ver asignados, pasar a `IN_PROGRESS`, agregar notas, resolver con nota de resolución.
- [ ] Completar el DTO de staff en `/a/[code]`: serie, inventario, técnico asignado, etapa actual del proceso e historial de reportes del equipo.
- [ ] La ficha elige el DTO según la sesión (público vs. staff).

**Pruebas**
- Integración: un TECHNICIAN no actúa sobre reportes de otros; resolver sin nota falla; el DTO de staff incluye los campos extra solo con sesión de staff.
- **La prueba de no filtración de la Fase 4 sigue en verde** (el DTO público no cambió).
- Manual con tres perfiles de navegador (o ventanas privadas): anónimo reporta → ADMIN asigna → TECHNICIAN pasa a en proceso y resuelve → STAFF escanea el mismo QR y ve técnico, etapa e historial. El estado del activo se ve correcto en cada paso.

**Listo cuando:** el flujo completo funciona de punta a punta y la ficha refleja cada cambio.

---

### Fase 9 — Notificaciones in-app
**Objetivo:** avisos en la aplicación para ADMIN y TECHNICIAN.
**Depende de:** Fase 8.

**Tareas**
- [ ] Servicio `notify(...)` y reglas: reporte nuevo → todos los ADMIN activos; asignación → el técnico asignado; reporte resuelto → todos los ADMIN activos.
- [ ] Se invoca desde los servicios de reportes, después de confirmar la transacción.
- [ ] Endpoint `GET /api/notifications` (requiere sesión) y acciones para marcar como leída una o todas.
- [ ] Campana en el encabezado con contador y lista; actualización por polling cada 30–60 s (sin websockets); cada aviso enlaza al reporte.

**Pruebas**
- Integración: cada evento genera avisos para los destinatarios correctos y para nadie más; usuarios inactivos no reciben; un usuario solo puede leer y marcar sus propios avisos; el contador de no leídas es correcto.
- Componente: la campana muestra contador y lista.
- Manual: crear un reporte desde el celular y ver la campana del ADMIN en la laptop.

**Listo cuando:** un reporte nuevo aparece en la campana del ADMIN y una asignación en la del técnico.

---

### Fase 10 — Correo electrónico *(recortable)*
**Objetivo:** correos de reporte nuevo y de asignación.
**Depende de:** Fase 9.

**Tareas**
- [ ] Interfaz `sendEmail` con implementación real (Resend o Nodemailer/SMTP; decidir aquí) y una de desarrollo (Mailpit en Docker o transporte falso).
- [ ] Plantillas de texto sencillas en español.
- [ ] Enviar: reporte nuevo → ADMIN; asignación → TECHNICIAN.
- [ ] Un error de correo se registra y **no** interrumpe la creación del reporte ni la asignación.

**Pruebas**
- Unitarias: plantillas incluyen folio, activo y enlace correcto.
- Integración con transporte falso: se intenta enviar al destinatario correcto; si el transporte lanza error, el reporte se crea igual.
- Manual: ver los correos en Mailpit al crear y asignar un reporte.

**Listo cuando:** los correos llegan al buzón de desarrollo y un fallo del transporte no rompe nada.

---

### Fase 11 — Seguridad, QA y E2E
**Objetivo:** cerrar huecos y automatizar el recorrido principal.
**Depende de:** Fases 1–10 (la 10 si no se recortó).

**Tareas**
- [ ] Prueba automatizada de la matriz de permisos: cada ruta y acción × (anónimo, STAFF, TECHNICIAN, ADMIN).
- [ ] Auditoría de filtración: revisar el HTML y las respuestas reales de la ficha pública (no solo lo que se ve en pantalla).
- [ ] Revisar límites de reporte, mensajes de error y que no se expongan ids internos ni datos de contacto.
- [ ] `pnpm audit`; revisar build scripts aprobados y dependencias directas.
- [ ] Revisión de secretos: `.env` no versionado, `.env.example` completo.
- [ ] Pulido móvil con celular real: estados vacíos, errores, carga, botones grandes.
- [ ] Playwright: un E2E del flujo principal contra la BD de pruebas.

**Pruebas**
- Automáticas: matriz de permisos; E2E (anónimo reporta → ADMIN asigna → TECHNICIAN resuelve → STAFF ve historial); `pnpm check` en verde.
- Manual: recorrido completo en el celular y en la laptop.

**Listo cuando:** la matriz de permisos y el E2E pasan, `pnpm audit` no tiene hallazgos graves sin atender y el recorrido móvil se siente fluido.

---

### Fase 12 — Despliegue y demo
**Objetivo:** app en producción con URL estable y demo ensayada.
**Depende de:** Fase 11.

**Tareas**
- [ ] Base de datos administrada (Neon o Supabase) y proyecto en Vercel; variables de entorno de producción.
- [ ] Build con `pnpm install --frozen-lockfile`; asegurar `prisma generate` en el build y `prisma migrate deploy` en el despliegue (según la guía vigente).
- [ ] Seed de demostración con **contraseñas distintas a las de desarrollo**.
- [ ] Fijar `APP_URL` definitiva y **regenerar los QR**; imprimir 3–4 (PC de laboratorio, proyector, pantalla, equipo de laboratorio).
- [ ] README: cómo correr el proyecto, variables de entorno, usuarios demo.
- [ ] Ensayo del guion de demo (sección 7).

**Pruebas**
- Automática: `GET /api/health` responde 200 en producción.
- Manual: escanear los QR impresos con el celular **con datos móviles** (no con el wifi de la laptop); completar la demo completa dos veces seguidas; confirmar que ningún archivo `.env` está en el repositorio.

**Listo cuando:** la demo completa sale bien dos veces consecutivas en producción.

## 6. Recorte de alcance (si te atrasas)

Sacrifica en este orden, de lo primero a lo último:

1. **Fase 10** (correo): quedan las notificaciones in-app.
2. E2E con Playwright y pruebas de componentes.
3. Anti-abuso más allá del honeypot (Fase 6).
4. CRUD de ubicaciones (texto libre en el activo).
5. Rol STAFF separado (usar ADMIN/TECHNICIAN).
6. Rechazo de reportes (`REJECTED`).

**Nunca recortar:** QR → ficha → reporte → asignación → cambio de estado → historial, ni las pruebas de dominio de la Fase 5 ni la de no filtración de la Fase 4.

## 7. Guion de demo (~5 min)

1. Mostrar el QR de una PC de laboratorio. Escanear con el celular **sin sesión** → ficha pública con estado "Funcionando".
2. Reportar una falla desde el celular → folio. Recargar la ficha: ahora "Falla reportada".
3. En la laptop como ADMIN: la campana avisa del reporte nuevo → abrir → asignar a un técnico.
4. Como TECHNICIAN: ver el reporte en "Mis reportes" → pasar a "En proceso" (la ficha muestra "En mantenimiento") → resolver con una nota.
5. Como STAFF: escanear el mismo QR → ver técnico, etapa e historial de reportes. El equipo vuelve a "Funcionando".

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Querer cubrir toda la propuesta empresarial | `CLAUDE.md` define lo que queda fuera; el backlog (sección 10) conserva las ideas. |
| La autenticación consume demasiado tiempo (librería nueva) | Tope de ~2 h en la Fase 2; sin registro, sin recuperación de contraseña. |
| `minimumReleaseAge` bloquea una versión recién publicada que necesitas | Esperar, o excepción puntual con `minimumReleaseAgeExclude` y motivo escrito. |
| Un build script legítimo queda bloqueado (p. ej. Prisma) | Revisarlo y aprobarlo con `pnpm approve-builds`; nunca permitir todos. |
| El QR no abre porque la app no es accesible desde el celular | Probar por red local desde la Fase 4 y con despliegue de vista previa desde la Fase 6. |
| Cambia la URL y los QR impresos quedan inservibles | Fijar el dominio en la Fase 12 y recién entonces imprimir los QR de la demo. |
| Spam o reportes falsos en el formulario público | Honeypot + límite por IP/activo; el ADMIN puede rechazar reportes. |
| Filtrar datos de staff en la ficha pública | DTO con lista explícita + prueba de no filtración en cada fase. |
| Falla el correo el día de la demo | Las notificaciones in-app son el canal principal; el correo es complemento. |
| Una sesión no alcanza para una fase | Dividir la fase en dos y mover lo pendiente; no dejar una fase a medias con pruebas rojas. |

## 9. Preguntas abiertas

Confirmar con el usuario (ver también "Decisiones abiertas" en `CLAUDE.md`):

1. ¿Horas reales disponibles por día y fecha exacta de entrega?
2. ~~¿Quien reporta recibe seguimiento por correo?~~ Decidido en la Fase 6: no en el MVP (ver `CLAUDE.md`).
3. ¿Dónde se desplegará la demo y con qué dominio? (Fase 12.)

## 10. Backlog posterior al MVP

Ideas de los borradores originales, en orden sugerido:

1. Foto en el reporte y comentarios internos.
2. Dashboard: reportes abiertos, tiempo de respuesta y de solución, equipos con fallas recurrentes.
3. Costos de reparación (piezas, mano de obra) y costo acumulado por activo.
4. Mantenimiento preventivo: fechas programadas, órdenes de trabajo, checklist y alertas.
5. Priorización automática por reglas (tipo de activo, ubicación, impacto).
6. Mapa del campus con concentración de incidencias.
7. Analítica de reemplazo y mantenimiento predictivo (estadística primero, ML después).
8. IoT opcional (ESP32 + sensores) como demostración de innovación.
9. Multi-institución (SaaS), planes de suscripción e integraciones por API.

Las partes de negocio de la propuesta empresarial (mercado, competencia, costos, precios, FODA, aspectos legales) no están cubiertas por este plan técnico.
