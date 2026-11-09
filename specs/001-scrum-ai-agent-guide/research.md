# Research: Decisiones técnicas

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Fecha**: 2026-11-09

Cada decisión sigue el formato Decisión / Justificación / Alternativas. Las decisiones del stack
(React, Vite, Tailwind, Fastify, Zod, PostgreSQL, Vitest, Playwright) vienen impuestas por el
encargo y no se re-evalúan; aquí solo se justifica lo que quedaba abierto. No quedan
`NEEDS CLARIFICATION` en el plan; las incertidumbres reales están en la sección final.

---

## D-01. ORM: Prisma (frente a Drizzle)

- **Decisión**: Prisma con migraciones versionadas (`prisma migrate`). Las restricciones que Prisma
  no expresa (CHECK, índices únicos parciales) se escriben como SQL dentro de la migración.
- **Justificación**: el esquema declarativo (`schema.prisma`) es legible para un equipo de dos
  personas que implementa de forma incremental; el cliente tipado reduce errores; `migrate dev` y
  `migrate deploy` cubren el flujo de migraciones; las transacciones interactivas (`$transaction`)
  cubren las operaciones críticas (evaluar compuerta, cambiar roles).
- **Alternativas**: *Drizzle* (más cercano a SQL y más ligero; exige más trabajo manual para
  migraciones y tiene una curva mayor para quien no domina SQL). Se acepta como alternativa válida
  si Prisma causara problemas de despliegue. *SQL puro con `pg`* (máximo control, mucho código
  repetitivo, contrario a DRY/KISS para el alcance).

## D-02. Un solo origen (frontend servido por el backend)

- **Decisión**: en producción, Fastify sirve la API en `/api/v1` y los archivos estáticos del
  frontend compilado desde el mismo origen y contenedor. En desarrollo, el servidor de Vite hace
  proxy de `/api` al backend, así también es el mismo origen.
- **Justificación**: elimina CORS entre frontend y API, simplifica las cookies `HttpOnly` +
  `SameSite=Lax` y la protección CSRF, y reduce a un servicio el despliegue. Cumple "frontend por
  HTTPS" porque la plataforma termina TLS.
- **Alternativas**: frontend en CDN (Cloudflare Pages/Vercel) y API aparte: más rápido para
  estáticos, pero obliga a CORS con credenciales, cookies entre sitios (`SameSite=None`) y dos
  despliegues; es complejidad que el prototipo no necesita. CORS queda deshabilitado por defecto y
  configurable con una lista blanca (`CORS_ALLOWED_ORIGINS`) solo si se separa el origen.

## D-03. Sesiones y CSRF

- **Decisión**: sesión en servidor guardada en PostgreSQL (tabla `session`); la cookie contiene un
  token aleatorio opaco (se guarda solo su hash SHA-256), `HttpOnly; Secure; SameSite=Lax; Path=/`.
  CSRF con doble defensa: (1) verificación de cabecera `Origin`/`Host` en métodos que modifican
  estado y (2) token CSRF por sesión enviado en la cabecera `X-CSRF-Token` (se obtiene en
  `GET /auth/csrf`). Caducidad absoluta de 7 días; se rota el identificador al iniciar sesión.
- **Justificación**: los tokens opacos en BD se pueden revocar (cerrar sesión, eliminar miembro) sin
  gestionar claves JWT; SameSite+Origin+token es una defensa en profundidad estándar.
- **Alternativas**: JWT en cookie (revocación compleja, sin ventaja aquí); sesión en memoria/Redis
  (un servicio más, sin necesidad); solo `SameSite` (insuficiente como única defensa).

## D-04. Hash de contraseñas

- **Decisión**: Argon2id con el paquete `argon2` (parámetros por defecto del paquete, ajustables por
  entorno), contraseña mínima de 10 caracteres, sin reglas de composición arbitrarias, y
  limitación de intentos de inicio de sesión con `@fastify/rate-limit` (por IP y por correo).
- **Alternativas**: bcrypt (aceptable pero Argon2id es la recomendación vigente); scrypt nativo de
  Node (sin dependencia, pero menos usado y con menos ajustes disponibles).

## D-05. Seudónimos

- **Decisión**: al registrarse, cada usuario recibe un seudónimo aleatorio `P-XXXXXX` (6 caracteres
  de un alfabeto sin ambigüedades, único en BD). El seudónimo no deriva del correo ni del nombre.
  Las exportaciones usan solo ese identificador.
- **Justificación**: cumple FR-028 y el Principio VI; el vínculo cuenta↔seudónimo existe solo en la
  tabla `user`, que nunca se exporta.
- **Riesgo conocido**: en un equipo pequeño, un lector con acceso al proyecto puede deducir quién es
  cada seudónimo por contexto (p. ej. responsables de acciones). Se documenta como limitación, no
  se resuelve con más funcionalidad.

## D-06. Concurrencia de edición (FR-036)

- **Decisión**: bloqueo optimista. Cada artefacto editable (`backlog_item`, `sprint`,
  `sprint_review`, `retrospective`) tiene un entero `version`; las modificaciones envían
  `expectedVersion`. Si no coincide, la API responde 409 `VERSION_CONFLICT` con el estado actual y
  la interfaz ofrece recargar o comparar antes de reintentar. La actualización es
  `UPDATE ... WHERE id = $1 AND version = $2` (atómica, sin bloqueos largos).
- **Alternativas**: bloqueo pesimista/edición exclusiva (peor experiencia, bloqueos huérfanos);
  edición colaborativa en tiempo real con CRDT (fuera de alcance del MVP según la spec).

## D-07. Reglas deterministas y semánticas (FR-009, FR-012, FR-023)

- **Decisión**: el motor de compuertas es un módulo **puro** (sin BD ni LLM): recibe una *instantánea*
  del artefacto y devuelve resultados por criterio. Todos los criterios que deciden el resultado
  de una compuerta son deterministas y reproducibles (presencia, longitud, listas de términos
  vagos, referencias cruzadas, solapamiento léxico). La IA aporta **observaciones semánticas
  asesoras** (por ejemplo "el objetivo parece no corresponder con las historias"), siempre
  etiquetadas como "Recomendación de IA" y sin influencia en el estado `PASSED/FAILED`.
- **Justificación**: es la única forma de cumplir a la vez FR-023 ("el resultado depende solo de
  reglas explícitas") y SC-009 (con IA caída las compuertas siguen funcionando), y permite
  pruebas unitarias exactas.
- **Limitación aceptada**: la "coherencia" entre objetivo, trabajo y plan se aproxima mediante
  solapamiento léxico; es una heurística burda que puede dar falsos positivos/negativos. La IA
  cubre la comprobación semántica como recomendación; el equipo humano decide.
- **Alternativas**: dejar que el LLM decida la aprobación (viola FR-023 y la reproducibilidad);
  dos modos de compuerta con "aprobación por IA" opcional (descartado: complejidad y riesgo).

## D-08. Catálogo de criterios en código, no en base de datos

- **Decisión**: los criterios y compuertas viven en un catálogo versionado en el repositorio
  (`backend/src/modules/validation/catalog/`, ver [rules-catalog.md](rules-catalog.md)) con
  `catalogVersion` (semver). La BD guarda `criterion_id` y `catalog_version` en cada resultado.
- **Justificación**: los criterios son parte del código revisado y probado, no datos del usuario;
  evita tablas de administración que el MVP no pide; garantiza trazabilidad requisito→regla→test
  (Principio II) y reproducibilidad (el resultado indica con qué versión se evaluó).
- **Alternativas**: tabla `criterion` editable (requiere UI/permiso de administración, fuera de
  alcance).

## D-09. Servicio del LLM

- **Decisión**: interfaz propia `LlmProvider` con un único método `complete(request)` que devuelve
  texto + metadatos (modelo, tokens, latencia). Adaptadores: `anthropic`, `openai-compatible` y
  `fake` (solo pruebas). Variables: `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`
  (opcional), `LLM_TIMEOUT_MS`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_TEMPERATURE`. Se llama con `fetch`
  nativo y `AbortSignal.timeout`; sin SDK obligatorio, para no atar el diseño a un proveedor.
- **Salidas estructuradas**: se pide JSON conforme a [contracts/ai-response.schema.json](contracts/ai-response.schema.json)
  y se valida con Zod en el servidor; si es inválido se reintenta una sola vez con un mensaje de
  reparación; si vuelve a fallar se devuelve `INVALID_RESPONSE` y la interfaz usa solo las reglas.
- **Reintentos**: máximo 1 reintento por error transitorio (429/5xx/red) con espera corta;
  tiempo límite por llamada 20 s (configurable); no hay reintento tras un timeout.
- **Alternativas**: SDK oficial por proveedor (menos código por proveedor, más acoplamiento);
  frameworks de agentes (LangChain, etc.): innecesarios, el agente no ejecuta herramientas.
- **No se fija un modelo concreto** en el plan: depende de coste y disponibilidad del equipo (ver
  incertidumbres). Se recomienda un modelo pequeño/rápido para el chat.

## D-10. Prompts versionados y protección frente a prompt injection

- **Decisión**: los prompts son archivos Markdown con parámetros en
  `backend/src/modules/agent/prompts/v1/` y una constante `PROMPT_VERSION`. Se registra la versión
  en cada interacción. Medidas contra inyección: (1) el texto del usuario y de los artefactos se
  envía dentro de bloques delimitados `<datos_usuario>` declarados como *datos, no instrucciones*;
  (2) el agente **no tiene herramientas** ni acceso a escritura: solo devuelve texto estructurado;
  (3) la salida se valida con esquema y se muestra como texto plano escapado (nunca HTML);
  (4) el resultado de compuerta jamás se calcula a partir de la salida del modelo; (5) límites de
  longitud y eliminación de caracteres de control en la entrada; (6) el contexto contiene solo
  datos del proyecto actual, nunca de otros proyectos, correos ni secretos.
- **Limitación**: ninguna medida elimina por completo la inyección; por eso la IA es asesora y su
  salida no tiene efectos secundarios.

## D-11. Costes y límites de consumo de IA

- **Decisión**: límites configurables: tamaño máximo del mensaje (p. ej. 2 000 caracteres), máximo
  de salida del modelo, historial de conversación acotado (últimas 6 interacciones), límite por
  usuario (p. ej. 10 solicitudes/minuto) y presupuesto diario de tokens por proyecto
  (`AI_DAILY_TOKEN_BUDGET_PER_PROJECT`). Al agotarse el presupuesto, el asistente informa y las
  reglas siguen funcionando. Se registran tokens de entrada/salida por interacción.
- Los valores concretos se calibrarán con el coste real del proveedor elegido (incertidumbre U-02).

## D-12. Marcas de tiempo y duraciones

- **Decisión**: todas las fechas son `timestamptz` en UTC generadas por el servidor
  (`now()` de PostgreSQL o un `Clock` inyectable en pruebas); el cliente nunca aporta tiempos
  registrados. Las duraciones se derivan de pares de marcas (`started_at`, `completed_at`) y se
  exportan como enteros en segundos; las fechas se exportan en ISO 8601 UTC con milisegundos.
- **Alternativas**: tiempos del cliente (manipulables, relojes distintos); duraciones almacenadas
  (redundantes, pueden divergir de las marcas).

## D-13. Pruebas con proveedor de IA simulado

- **Decisión**: `FakeLlmProvider` guionizable (respuesta válida, inválida, timeout, 429, vacía)
  inyectado por configuración (`LLM_PROVIDER=fake`). Su salida **solo** se usa en pruebas
  automáticas; nunca se exporta como dato real (Principio V). Existe una prueba de contrato contra
  el proveedor real, desactivada por defecto (`LLM_LIVE_TESTS=1`), para verificar el formato.
- Las pruebas de integración usan PostgreSQL real (contenedor), no mocks de BD.

## D-14. Estilo de la interfaz y estado del cliente

- **Decisión**: React Router (modo biblioteca, rutas declarativas), Tailwind con tokens de diseño
  propios y componentes propios accesibles (HTML semántico, `aria-*`, foco visible). Estado del
  servidor mediante un hook propio `useResource` (carga/error/recarga) y `fetch` con un envoltorio
  que añade el token CSRF. Esquemas Zod compartidos con el backend en el paquete `shared/`.
  `eslint-plugin-jsx-a11y` y `@axe-core/playwright` verifican accesibilidad.
- **Alternativas**: TanStack Query (cache e invalidación más cómodas; es una dependencia que el
  encargo no lista y el MVP puede resolver con un hook pequeño; se reconsidera si el hook crece);
  librería de componentes (Material, Chakra): más peso y menos control del estilo.

## D-15. Hosting de bajo costo

- **Decisión**: un solo contenedor Docker (API + estáticos) en **Render** (servicio web) y la base de
  datos en **Neon** (PostgreSQL gestionado). Desarrollo: gratis (plan gratuito). Durante las
  sesiones del experimento: instancia de pago mínima de Render para evitar el modo inactivo.
- **Justificación**: despliegue desde un repositorio Git con HTTPS automático y secretos en el
  panel; Neon ofrece PostgreSQL estándar con plan gratuito y escalado a cero, suficiente para
  un prototipo con decenas de usuarios; ambos tienen operación mínima, adecuada para un equipo de
  dos estudiantes. PostgreSQL estándar permite migrar a otro proveedor sin cambios.
- **Hallazgos de la búsqueda** (secundarios, sin verificar en fuentes del proveedor; **confirmar
  precios y límites antes de contratar**):
  - El servicio web gratuito de Render se suspende tras ~15 min de inactividad con arranque en frío
    de 30 s o más: aceptable en desarrollo, mal para sesiones de uso con equipos.
  - La base gratuita de Render caduca a los 30 días; por eso la BD va en Neon.
  - Neon (plan gratuito): ~1 GB por proyecto y 100 horas de cómputo con escalado a cero tras
    inactividad; la documentación consultada no deja claras las condiciones de copia/restauración
    en el plan gratuito.
  - Fly.io: la información sobre su capa gratuita es contradictoria entre fuentes; un comparativo
    cita PostgreSQL gestionado en torno a 38 USD/mes, demasiado caro para este caso.
  - Railway: fuentes en desacuerdo sobre su oferta gratuita (créditos de prueba).
- **Alternativas**: *VPS económico con Docker Compose y proxy HTTPS* (coste fijo bajo, sin arranque en
  frío, pero exige administrar sistema, parches y copias: más carga operativa para el equipo);
  *Fly.io* y *Railway* (válidos, coste/condiciones por confirmar); *Supabase* (BaaS completo:
  duplicaría funciones de autenticación y API que ya se diseñan aquí).

### Fuentes consultadas

- [Where to run Postgres or SQLite for a side project](https://flaviocopes.com/database-hosting-options/)
- [Free PostgreSQL Hosting: Every Real Option in 2026](https://swyftstack.com/blog/free-postgresql-hosting)
- [Platforms with a real free tier in 2026 (Render)](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
- [Neon: Free plan limits and quotas](https://neon.com/faqs/free-plan-limits-and-quotas)
- [Railway vs Render vs Fly.io 2026 (PkgPulse)](https://www.pkgpulse.com/guides/railway-vs-render-vs-fly-io-app-hosting-platforms-2026)

## D-16. Copias de seguridad básicas

- **Decisión**: (1) historial/restauración que ofrezca el plan de Neon (límites por confirmar);
  (2) procedimiento documentado de `pg_dump` manual antes de cada sesión del experimento y de
  cualquier migración, con el volcado guardado cifrado fuera del repositorio; (3) prueba de
  restauración documentada en el [quickstart](quickstart.md). La automatización con un flujo
  programado de GitHub Actions es opcional.
- **Nota de privacidad**: los volcados contienen correos; se cifran y se eliminan al cerrar el experimento.

## D-17. Registro de actividad y exportación

- **Decisión**: tabla `activity_log` de solo inserción alimentada por los servicios de dominio
  (misma transacción que el cambio). La exportación se genera bajo demanda (no se almacena) en JSON
  (documento único) o CSV (un conjunto de datos por solicitud, evitando dependencias de ZIP), con
  neutralización de inyección de fórmulas en CSV (prefijo `'` en celdas que empiezan por `=`, `+`,
  `-`, `@`). Detalle del formato en [contracts/export-format.md](contracts/export-format.md).
- Por defecto el contenido libre (preguntas y respuestas del asistente, textos de artefactos) **no**
  se exporta; solo metadatos y resultados, para minimizar datos personales (FR-028). Se puede
  incluir con `includeText=true`.

---

## Incertidumbres reales (no resueltas, sin inventar requisitos)

| ID | Incertidumbre | Impacto | Cómo se resuelve |
|----|---------------|---------|------------------|
| U-01 | Proveedor y modelo de LLM concretos | Coste, latencia, calidad de sugerencias | Decisión del equipo; el diseño es agnóstico (D-09). Prueba piloto de 5–10 casos antes de fijarlo |
| U-02 | Valores de límites y presupuesto de tokens | Coste y experiencia | Calibrar con el coste real del proveedor elegido |
| U-03 | Precios y límites vigentes de hosting (Render/Neon) y condiciones de copia de seguridad del plan gratuito | Coste y riesgo de pérdida de datos | Verificar en las páginas oficiales antes del despliegue (tarea previa) |
| U-04 | Calidad de la heurística léxica de coherencia y del diccionario de términos vagos en español | Falsos positivos/negativos en compuertas | Calibrar con casos de prueba reales del curso; versionar `catalogVersion` en cada cambio |
| U-05 | Redacción exacta de los elementos oficiales de la Scrum Guide 2020 citados en el catálogo | Rigor de la clasificación oficial/adicional (Principio III) | Contrastar cada referencia con el texto de la guía antes de cerrar el catálogo |
| U-06 | Reidentificación por contexto dentro de un equipo pequeño | Privacidad en exportaciones | Limitación documentada (D-05); el análisis externo debe tratarla |
