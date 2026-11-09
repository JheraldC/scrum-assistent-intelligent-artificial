# Implementation Plan: Agente Inteligente para la Guía y Validación del Proceso Scrum

**Branch**: `001-scrum-ai-agent-guide` (directorio de la feature; no se creó rama git) | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-scrum-ai-agent-guide/spec.md`

## Summary

Aplicación web cliente-servidor siempre asistida por IA que guía a equipos novatos por el flujo de un
Sprint (planificación, seguimiento, revisión, retrospectiva), valida criterios mínimos mediante un
**motor de reglas determinista** con compuertas, y ofrece un **asistente conversacional** cuyas
recomendaciones se distinguen de las comprobaciones por reglas. Registra datos objetivos y los exporta
(CSV/JSON, solo seudónimos) para el experimento, que se realiza fuera de la aplicación.

Enfoque técnico (justificación en [research.md](research.md)):

- Monorepo con `frontend/` (React + TypeScript + Vite + Tailwind), `backend/` (Node.js + Fastify +
  Zod + Prisma), `shared/` (esquemas Zod) y `e2e/` (Playwright).
- Un único origen: Fastify sirve la API (`/api/v1`) y el frontend compilado; un solo contenedor.
- PostgreSQL con migraciones versionadas, restricciones e índices que protegen la integridad
  (Sprint abierto único, intentos consecutivos, un Facilitador mínimo).
- Motor de validación **puro** y catálogo versionado en código ([rules-catalog.md](rules-catalog.md)):
  la IA aporta observaciones asesoras y **nunca** decide el estado de una compuerta.
- Servicio LLM con interfaz agnóstica del proveedor y **Groq (plan gratuito) como proveedor
  decidido**, con salidas estructuradas validadas, prompts versionados, tiempos límite, reintento
  acotado, presupuestos diarios de tokens (global y por proyecto) y registro de modelo/configuración.
  El cupo gratuito es pequeño y compartido, por eso el contexto se limita a ~2 500 tokens.

Esta fase **no implementa código**: produce el diseño que Jherald y Ariel construirán de forma
incremental (el desglose en tareas corresponde a `/speckit-tasks`).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js LTS (≥ 22) en backend; TypeScript 5.x + React (versión estable vigente al inicializar) en frontend. Versiones exactas fijadas con lockfile.

**Primary Dependencies**:
- Backend: Fastify, `@fastify/cookie`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/static`, Zod, Prisma (cliente + CLI), `argon2`, `pino` (incluido en Fastify).
- Frontend: React, React Router, Tailwind CSS, Vite.
- Compartido: Zod (paquete `shared/`).
- Pruebas: Vitest, Playwright, `@axe-core/playwright`, `eslint-plugin-jsx-a11y`.
- Sin SDK de proveedor de IA obligatorio (se usa `fetch` nativo; ver D-09).

**Storage**: PostgreSQL centralizado (gestionado); migraciones con Prisma; sesiones en PostgreSQL.

**Testing**: Vitest (unitarias e integración de API/BD con PostgreSQL real), Playwright (funcionales end-to-end), `FakeLlmProvider` para reproducibilidad.

**Target Platform**: Servidor Linux en contenedor Docker; navegadores modernos de escritorio y móvil (ancho mínimo 375 px).

**Project Type**: Aplicación web (frontend + backend + paquete compartido).

**Performance Goals**: respuestas de la API (sin IA) con p95 < 500 ms con ~50 usuarios concurrentes; evaluación de una compuerta < 1 s sin IA; llamada a IA con tiempo límite de 20 s sin bloquear la visualización de los resultados de reglas.

**Constraints**: toda la interfaz en español (FR-031); mismo origen y cookies `HttpOnly`; secretos solo en variables de entorno; resultado de compuertas independiente de la IA (FR-023); sin modo sin IA ni interruptor; presupuesto de IA acotado.

**Scale/Scope**: prototipo académico: ≤ 50 usuarios, ≤ 20 proyectos, una instancia del servidor; 13 pantallas; 4 compuertas (2 bloqueantes) y 25 criterios en el catálogo inicial.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en el plan | Estado |
|-----------|-------------------------|--------|
| I. Calidad y mantenibilidad | Módulos con dependencias unidireccionales (rutas→servicios→dominio/repositorios); motor puro; sin dependencias extra (sin TanStack Query, sin librerías de UI, sin SDK de IA); decisiones en `research.md` | ✅ |
| II. Desarrollo guiado por especificaciones | Cada FR/SC se asigna a módulo y pruebas ([tabla de trazabilidad](#estrategia-de-pruebas-y-trazabilidad)); catálogo de criterios trazado a FR | ✅ |
| III. Calidad de validaciones Scrum | Scrum Guide 2020 como referencia; criterios marcados `OFFICIAL`/`ADDITIONAL`; reglas deterministas; IA solo asesora y etiquetada; solo 2 bloqueos, declarados como controles del prototipo | ✅ |
| IV. IA responsable | Esquema validado, errores/timeout gestionados, clave solo en servidor, modelo y configuración registrados, aviso de no garantizado | ✅ |
| V. Testing | Unitarias, integración, funcionales, concurrencia, aislamiento; foco en reglas y compuertas; IA simulada solo en pruebas | ✅ |
| VI. Rigor experimental | Registro objetivo y exportación; seudónimos; sin valores inventados; datos de ejemplo marcados y excluidos; **sin** comparación dentro del software (decisión de la spec, recogida en la Constitución v2.0.0: el sistema exporta datos para la comparación externa) | ✅ |
| VII. Usabilidad | Interfaz en español, responsiva, orientación para novatos, estados visuales, accesibilidad verificada | ✅ |
| VIII. Documentación y reproducibilidad | README, arquitectura, contratos, modelo de datos, `quickstart.md`, diagramas | ✅ |

**Re-evaluación posterior al diseño (Phase 1)**: sin violaciones. Se justifica una desviación menor
en *Complexity Tracking* (paquete `shared/`). Puntos de atención, no violaciones: la heurística de
coherencia léxica es limitada (U-04) y la reidentificación por contexto es posible en equipos
pequeños (U-06); ambas se documentan en lugar de resolverse con más funcionalidad.

## Project Structure

### Documentation (this feature)

```text
specs/001-scrum-ai-agent-guide/
├── spec.md                  # Especificación aprobada (fuente de verdad)
├── plan.md                  # Este archivo
├── research.md              # Decisiones, alternativas, incertidumbres
├── data-model.md            # Esquema relacional, estados, integridad
├── rules-catalog.md         # Compuertas y criterios (oficial / adicional)
├── quickstart.md            # Instalación, ejecución y validación reproducible
├── contracts/
│   ├── openapi.yaml         # Contrato REST
│   ├── export-format.md     # Formato CSV/JSON de exportación
│   └── ai-response.schema.json  # Forma de las respuestas del modelo
├── diagrams/
│   ├── 01-arquitectura-general.md
│   ├── 02-componentes.md
│   ├── 03-entidad-relacion.md
│   ├── 04-secuencia-validacion.md
│   ├── 05-estados-compuertas.md
│   └── 06-despliegue.md
├── checklists/requirements.md
└── tasks.md                 # NO se crea aquí (/speckit-tasks)
```

### Diagramas (Mermaid)

1. [Arquitectura general](diagrams/01-arquitectura-general.md)
2. [Componentes y dependencias](diagrams/02-componentes.md)
3. [Entidad-relación](diagrams/03-entidad-relacion.md)
4. [Secuencia de validación de artefactos](diagrams/04-secuencia-validacion.md)
5. [Estados de compuertas y etapas](diagrams/05-estados-compuertas.md)
6. [Despliegue](diagrams/06-despliegue.md)

### Source Code (repository root)

Monorepo con `npm workspaces`. Estructura objetivo (se crea al implementar):

```text
package.json                      # workspaces: shared, backend, frontend, e2e
docker-compose.yml                # PostgreSQL de desarrollo y de pruebas
Dockerfile                        # build multi-etapa: frontend → backend → imagen final
.env.example                      # variables documentadas (sin secretos reales)
README.md                         # instalación, configuración, ejecución, pruebas (Principio VIII)
docs/decisions/                   # registros breves de decisiones nuevas (ADR) durante la implementación

shared/
└── src/                          # esquemas Zod, enums, tipos y códigos de error compartidos

backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/               # versionadas; SQL manual para CHECK e índices parciales
│   └── seed.ts                   # solo proyecto de ejemplo (is_sample) y cuentas de desarrollo
├── src/
│   ├── main.ts                   # arranque; app.ts construye la instancia (testeable)
│   ├── platform/                 # config (Zod sobre env), logger, clock, errores, sesión/CSRF, rate-limit
│   ├── modules/
│   │   ├── auth/                 # routes · service · repository · schemas
│   │   ├── projects/             # proyectos, miembros, roles por proyecto, estado derivado
│   │   ├── backlog/              # Product Backlog e historias
│   │   ├── sprints/              # Sprint, items, etapas, evidencia
│   │   ├── artifacts/            # seguimiento, review, retrospectiva y acciones
│   │   ├── validation/           # MOTOR PURO: catalog/ · rules/ · gate-state · dictionaries/
│   │   ├── flow/                 # orquestación: evaluateGate, grantException, completeStage
│   │   ├── agent/                # llm/ (provider, openai-compatible [Groq], fake) · prompts/v1/ · context · budget · service
│   │   ├── activity/             # registro de solo inserción
│   │   └── export/               # generadores CSV/JSON y neutralización de fórmulas
│   └── http/                     # registro de rutas, manejador global de errores, servidor de estáticos
└── tests/
    ├── unit/                     # reglas, estados, utilidades, validación de respuestas del LLM
    ├── integration/              # API + PostgreSQL real, autorización, aislamiento, concurrencia, exportación
    └── helpers/                  # fábricas de datos, app de pruebas, FakeLlmProvider guionizable

frontend/
├── index.html
├── src/
│   ├── main.tsx · app/           # router, layout, proveedores (sesión), manejo de errores
│   ├── pages/                    # una carpeta por pantalla (ver "Diseño de interfaces")
│   ├── components/               # componentes reutilizables y accesibles (ui/, flow/, validation/, agent/)
│   ├── api/                      # cliente fetch con CSRF, tipos de respuesta y hook useResource
│   ├── i18n/es.ts                # textos de la interfaz centralizados (todo en español)
│   └── styles/                   # tokens de Tailwind
└── tests/                        # pruebas de componentes críticos (Vitest)

e2e/
├── playwright.config.ts
└── tests/                        # flujos completos con servidor real y LLM simulado; axe para accesibilidad
```

**Structure Decision**: aplicación web con backend y frontend separados en un monorepo, más un
paquete `shared/` para los esquemas Zod. Un solo despliegue (contenedor único) y un solo origen. Los
módulos del backend corresponden uno a uno con los módulos pedidos; "usuarios y roles por proyecto" va
dentro de `projects/` y "autenticación y cuentas" en `auth/` para no multiplicar carpetas.

## Arquitectura modular

Ver [diagrama de componentes](diagrams/02-componentes.md). Reglas de arquitectura (verificables con
una regla de lint de importaciones):

1. **Capas por módulo**: `routes` (HTTP, validación Zod de entrada/salida, autorización) → `service`
   (casos de uso, transacciones) → `repository` (Prisma) y `domain` (tipos y reglas sin E/S).
2. Un módulo solo importa la **interfaz pública** (`index.ts`) de otro; nada de acceso cruzado a sus
   repositorios.
3. `validation` no importa Prisma, Fastify ni el módulo `agent`: son funciones puras sobre
   instantáneas (objetos planos). `flow` carga las instantáneas y persiste los resultados.
4. `agent` puede leer resultados de reglas, pero no tiene API de escritura sobre artefactos ni sobre
   compuertas (FR-021, FR-023).
5. Todo el acceso a datos de negocio pasa por funciones que reciben `projectId` (FR-035).

| Módulo | Responsabilidad | Interfaz con otros módulos |
|--------|-----------------|----------------------------|
| `auth` | Registro, login/logout, sesión, CSRF, seudónimo | `requireAuth` (hook), `getCurrentUser` |
| `projects` | Proyectos, miembros, roles por proyecto, estado derivado, regla de al menos un Facilitador por proyecto | `requireProjectRole(...roles)` (hook), `getMembership` |
| `backlog` | CRUD de elementos/historias, orden, versión | `getItemSnapshot`, `listSelectable` |
| `sprints` | Sprint, selección de elementos, etapas y transiciones, evidencia | `getSprintSnapshot`, `setStageStatus` |
| `artifacts` | Seguimiento, Review, Retrospectiva y acciones | `getReviewSnapshot`, `getRetroSnapshot` |
| `validation` | Catálogo, `evaluate`, `deriveGateState`, diccionarios | funciones puras |
| `flow` | `evaluateGate` (transacción), `grantException`, `completeStage` | usado solo por rutas |
| `agent` | `chat`, `feedbackForRun`, contexto, prompts, presupuesto | `AgentService` |
| `activity` | `record(event)` en la misma transacción | `ActivityRecorder` |
| `export` | `generate(projectId, options)` | usado solo por rutas |

### Manejo de errores y registros

- Manejador global que devuelve `Problem` (`code`, `message` en español, `details`, `requestId`);
  errores de Zod → 422; no se filtran trazas ni mensajes internos.
- `pino` en JSON con `requestId`; se redactan `cookie`, `authorization`, `password`, `email` y
  claves; no se registra el contenido de preguntas ni de artefactos.
- Los fallos del LLM se traducen a códigos `AI_*` y se guardan en `agent_interaction`.

## Autenticación y autorización

Decisiones en [research.md](research.md) D-03 a D-05.

- **Registro/inicio de sesión** con correo y contraseña (mín. 10 caracteres); hash **Argon2id**;
  mensajes de error genéricos para credenciales incorrectas; límite de intentos por IP y por correo.
- **Sesión**: token opaco en cookie `HttpOnly; Secure; SameSite=Lax`; en servidor solo su hash;
  caducidad de 7 días; rotación al iniciar sesión; revocación al cerrar sesión.
- **CSRF**: verificación de `Origin` + token `X-CSRF-Token` en métodos que modifican estado.
- **Roles por proyecto**: `PARTICIPANT` y `FACILITATOR` en `project_member`. El gancho
  `requireProjectRole` resuelve la membresía por `(projectId, userId)` en cada petición:
  - sin membresía → **404** (no se revela la existencia del proyecto);
  - rol insuficiente → **403**.
- Matriz de permisos:

  | Operación | Participante | Facilitador |
  |-----------|:------------:|:-----------:|
  | Ver proyecto, backlog, Sprint, historial, interacciones, usar el asistente | ✅ | ✅ |
  | Crear/editar historias, Sprint Goal, plan, seguimiento, review, retrospectiva | ✅ | ✅ |
  | Evaluar compuertas, completar etapas | ✅ | ✅ |
  | Crear Sprint, editar proyecto, gestionar miembros y roles | ❌ | ✅ |
  | Autorizar excepciones de compuerta | ❌ | ✅ |
  | Exportar datos | ❌ | ✅ |
  | Ver correos de miembros | ❌ | ✅ |

- Cualquier persona autenticada puede crear proyectos y pasa a ser Facilitador del suyo; puede ser
  Participante en otros.
- No se exponen contraseñas, tokens ni claves en respuestas, registros ni exportaciones (FR-037).

## Agente inteligente

### Arquitectura del servicio LLM

```text
agent/
├── llm/provider.ts              # interfaz LlmProvider.complete(req) → { text, model, tokens, latencyMs }
├── llm/openai-compatible.ts     # adaptador (fetch); proveedor por defecto: Groq vía LLM_BASE_URL
├── llm/fake.ts                  # solo pruebas: guion de respuestas, errores y retardos
├── prompts/v1/                  # system.md · chat.md · validation-feedback.md  (PROMPT_VERSION = "v1")
├── context.ts                   # arma el contexto acotado al proyecto
├── budget.ts                    # límites por usuario y presupuesto diario del proyecto
├── output.ts                    # esquemas Zod de salida (equivalen a contracts/ai-response.schema.json)
└── service.ts                   # chat(), feedbackForRun(): orquesta, reintenta, registra
```

Configuración por variables de entorno (validadas con Zod al arrancar): `LLM_PROVIDER`, `LLM_MODEL`,
`LLM_API_KEY`, `LLM_BASE_URL` (Groq), `LLM_TIMEOUT_MS` (20 000), `LLM_MAX_OUTPUT_TOKENS`,
`LLM_TEMPERATURE`, `AI_USER_RATE_PER_MINUTE`, `AI_DAILY_TOKEN_BUDGET_GLOBAL` y
`AI_DAILY_TOKEN_BUDGET_PER_PROJECT`. Valores por defecto de partida (a calibrar, U-02):
`LLM_PROVIDER=openai-compatible`, `LLM_BASE_URL` = endpoint compatible de Groq, `LLM_MODEL` = el
elegido en el piloto (U-01). El servidor **no arranca en producción** con `LLM_PROVIDER=fake`.

### Contexto enviado al modelo

Solo datos del proyecto actual, en este orden y con límites de tamaño: objetivo del producto →
resumen de etapas y estado → artefacto en foco (instantánea) → últimos resultados de reglas del
artefacto (criterios incumplidos con su explicación) → catálogo de criterios relevante (id, título,
origen oficial/adicional) → últimas 4 interacciones → mensaje de la persona. El total se recorta
por prioridad para no superar ~2 500 tokens de entrada (el cupo gratuito diario es pequeño y
compartido; ver [research.md](research.md) D-11). **Nunca**: correos, seudónimos de otras
personas, datos de otros proyectos, claves ni cookies.

### Estructura de los prompts

1. **Sistema** (`system.md`): rol (orientador de Scrum para novatos, en español), reglas de
   conducta (no decidir aprobaciones, no inventar criterios, diferenciar lo oficial de Scrum de los
   criterios adicionales del prototipo, no presentar certezas, no modificar nada), formato de
   salida y política frente a instrucciones dentro de los datos.
2. **Tarea** (`chat.md` / `validation-feedback.md`): instrucciones específicas y esquema JSON esperado.
3. **Datos** delimitados con etiquetas (`<datos_proyecto>`, `<datos_usuario>`), declarados como
   información, no como instrucciones.

### Formato, validación y errores

- Salida JSON conforme a [contracts/ai-response.schema.json](contracts/ai-response.schema.json),
  validada con Zod; texto plano, escapado en la interfaz.
- Salida inválida → un único reintento de reparación → si persiste, `INVALID_RESPONSE`.
- Errores transitorios (429/5xx/red) → un reintento con espera corta; tiempo agotado → sin reintento.
- En cualquier fallo: la API devuelve el resultado de reglas intacto (`aiStatus` indica el error), el
  chat responde `502 AI_*` con mensaje claro, y se registra la interacción con su estado.
- **Una respuesta inválida o ausente no puede producir una aprobación**: el estado de la compuerta se
  calcula antes y sin la IA ([secuencia](diagrams/04-secuencia-validacion.md)).

### Protección frente a prompt injection

Datos delimitados y declarados como no confiables; el agente no tiene herramientas ni escritura; la
salida se valida con esquema y se muestra como texto; el resultado de compuertas nunca depende del
modelo; contexto estrictamente del proyecto; longitud máxima y limpieza de caracteres de control en
la entrada; pruebas con cadenas de inyección conocidas ("ignora las instrucciones…", pedir revelar el
prompt o aprobar la compuerta) comprobando que no cambian ningún estado (ver D-10).

### Costos, límites, versionado

- **La retroalimentación de IA se pide bajo demanda** (botón «Pedir recomendación de IA» →
  `POST .../validations/{id}/ai-feedback`), no en cada evaluación, para no gastar el cupo diario;
  `requestAiFeedback` en `POST /validations` queda en `false` por defecto.
- Límites: tamaño de mensaje (2 000 caracteres), tokens máximos de salida, historial acotado,
  solicitudes por minuto por persona, **presupuesto diario global** de tokens (por debajo del cupo
  gratuito de Groq, que es por organización y modelo) y **presupuesto diario por proyecto** (fracción
  del global). Las cabeceras de límite del proveedor prevalecen sobre el contador local. Al
  agotarse: `AI_BUDGET_EXCEEDED` con la hora de restablecimiento y las reglas siguen funcionando
  (SC-009). Un solo modelo configurado, sin proveedores ni modelos de respaldo, para mantener
  comparable el experimento. Valores a calibrar (U-02); términos de datos y estabilidad del plan
  gratuito por confirmar (U-07).
- Cada interacción guarda `provider`, `model`, `model_config`, `prompt_version`, tokens y latencia
  (FR-025, SC-008). Cambiar el prompt exige nueva carpeta `v2/` y registrar la versión.
- Distinción A/B (Scrum Guide vs. criterios del prototipo): el catálogo marca el origen de cada
  criterio, el contexto lo incluye y el prompt obliga a mencionarlo al explicar un incumplimiento;
  la interfaz muestra la insignia "Oficial de Scrum" o "Criterio adicional del prototipo".

## Compuertas de validación

Detalle completo: [rules-catalog.md](rules-catalog.md), [data-model.md](data-model.md) y
[estados](diagrams/05-estados-compuertas.md).

- **Motor puro**: `evaluate(gateId, snapshot, catalog) → { status, results[] }` determinista;
  idéntica entrada ⇒ idéntico resultado; sin acceso a red, BD ni reloj.
- **Cada compuerta** tiene identificador (`GATE-*`), objetivo/etapa, criterios con origen y
  obligatoriedad, método determinista, resultado, evidencia, explicación y recomendación, y estado de
  aprobación derivado (`NO_EVALUADA`, `APROBADA`, `NO_APROBADA`, `APROBADA_CON_EXCEPCION`,
  `DESACTUALIZADA`).
- **Bloqueos del prototipo** (no reglas de Scrum): iniciar el seguimiento exige `GATE-PLAN`
  aprobada o con excepción; cerrar el Sprint exige `GATE-RETRO`. Las demás etapas y la edición del
  backlog no se bloquean. Esto evita suponer una secuencia obligatoria de todos los eventos.
- **Avance** (`completeStage`) en una transacción: comprobar compuerta vigente (misma versión del
  objetivo) → actualizar etapa → registrar actividad → si es la retrospectiva, cerrar el Sprint.
- **Reevaluación**: cada evaluación crea un nuevo intento (`attempt_no`) bajo bloqueo de la fila del
  artefacto; los intentos previos se conservan.
- **Fallo del motor** (`ERROR`) no aprueba. **Excepción** solo del Facilitador, solo sobre una
  evaluación `FAILED` vigente, con justificación obligatoria y registro.

## Registro y exportación

- `activity_log` de solo inserción alimentado por los servicios en la misma transacción del cambio;
  `validation_run`/`criterion_result` guardan intentos y resultados; `agent_interaction` guarda uso y
  modelo; `sprint_stage` guarda `started_at`/`completed_at`.
- **Tiempo**: marcas de tiempo del servidor (`timestamptz` UTC); duraciones derivadas en segundos;
  `Clock` inyectable para pruebas; el cliente nunca aporta tiempos.
- **Exportación** bajo demanda, solo Facilitador, con seudónimos, sin correos ni datos de
  autenticación, sin valores inventados, ejemplo excluido por defecto y texto libre opcional:
  [contracts/export-format.md](contracts/export-format.md).
- **Fuera de alcance (no se implementa)**: modo sin IA, interruptor de IA, comparación experimental
  dentro del software, evaluación a ciegas, rúbricas de puntuación, panel estadístico, módulo de
  investigación.

## Diseño de interfaces

Interfaz 100 % en español (textos centralizados en `frontend/src/i18n/es.ts`), diseño responsivo
con Tailwind (móvil primero, ancho mínimo 375 px) y navegación simple.

| Pantalla | Ruta | Requisitos | Contenido principal |
|----------|------|------------|---------------------|
| Registro / inicio de sesión | `/registro`, `/entrar` | FR-001 | Formularios con validación en línea y errores claros |
| Panel de proyectos | `/proyectos` | FR-002, FR-004 | Lista con rol y estado derivado; botón "Crear proyecto" |
| Crear/configurar proyecto | `/proyectos/nuevo`, `/proyectos/:id/ajustes` | FR-002 | Nombre, descripción, objetivo del producto |
| Participantes | `/proyectos/:id/participantes` | FR-002, FR-003 | Agregar por correo, rol por proyecto, quitar (solo Facilitador) |
| Flujo guiado | `/proyectos/:id` | FR-005, FR-006, FR-007 | Cuatro etapas con estado, compuertas, evidencia y guía breve "qué se espera" |
| Product Backlog | `/proyectos/:id/backlog`, `/backlog/:itemId` | FR-008–FR-010 | Lista ordenada, editor de historia, evaluación con criterios y sugerencias |
| Sprint Planning | `/proyectos/:id/sprint/planificacion` | FR-011–FR-017 | Sprint Goal, selección, plan, botón "Evaluar", resultados y excepción |
| Seguimiento | `/proyectos/:id/sprint/seguimiento` | FR-038 | Avances, impedimentos, notas diarias, plan |
| Sprint Review | `/proyectos/:id/sprint/revision` | FR-039 | Resultados, incremento, retroalimentación, relación con el objetivo |
| Retrospectiva | `/proyectos/:id/sprint/retrospectiva` | FR-018, FR-019 | Positivos/problemas/mejoras, acciones con responsable y seguimiento |
| Resultados de validación | panel lateral/página `/proyectos/:id/validaciones` | FR-012–FR-017 | Historial de intentos, criterios con origen, evidencia, explicación |
| Asistente IA | panel acoplado en todas las pantallas del proyecto | FR-020–FR-025 | Chat contextual, etiqueta "Recomendación de IA", aviso de no garantizado |
| Historial y exportación | `/proyectos/:id/historial` | FR-004, FR-027–FR-030 | Actividad cronológica; exportar CSV/JSON (solo Facilitador) |

**Componentes principales**: `StageStepper` (flujo con estados), `GateResultPanel` (lista de
criterios con insignias *Cumplido / No cumplido / No aplica* y *Oficial de Scrum / Criterio
adicional*), `SourceBadge` (*Comprobación por reglas* vs. *Recomendación de IA*), `AssistantPanel`,
`VersionConflictDialog`, `FormField` accesible, `EmptyState`, `ErrorBanner`, `LoadingSkeleton`.

**Estados**: carga (esqueletos), vacío (mensaje y acción sugerida), error (mensaje claro + reintentar),
conflicto de versión (diálogo: recargar o ver cambios), IA no disponible (aviso; las reglas
siguen visibles), éxito (aviso no intrusivo con `aria-live`).

**Accesibilidad y usabilidad**: HTML semántico, foco visible, contraste suficiente (no solo color: el
estado lleva icono y texto), navegación por teclado, etiquetas en formularios, anuncios `aria-live`
para resultados, textos de ayuda para novatos; `eslint-plugin-jsx-a11y` y comprobaciones `axe` en
las pruebas e2e.

## Despliegue

Detalle: [diagrama](diagrams/06-despliegue.md), [research.md](research.md) D-15 y D-16.

- **Hosting recomendado (bajo costo)**: contenedor único en Render + PostgreSQL en Neon; desarrollo
  en plan gratuito y, durante las sesiones del experimento, instancia mínima de pago para evitar la
  suspensión por inactividad. **Precios y límites por verificar** antes de contratar (U-03).
- **HTTPS**: TLS terminado por la plataforma; cookies `Secure`; HSTS con `helmet`.
- **Variables protegidas**: `DATABASE_URL`, `SESSION_SECRET`, `LLM_*`, en el panel del proveedor; no
  en el repositorio; `.env.example` sin valores reales; validación de entorno al arrancar.
- **CORS seguro**: cerrado por defecto (mismo origen); lista blanca explícita solo si se separa el
  frontend; sin comodines con credenciales.
- **Migraciones**: `prisma migrate deploy` al arrancar el servicio, tras volcado de seguridad.
- **Logs y errores**: JSON con `requestId`, sin datos personales; manejador global.
- **Copias de seguridad básicas**: restauración del proveedor (límites por confirmar) + `pg_dump`
  cifrado antes de sesiones y migraciones + prueba de restauración documentada.
- **Desarrollo vs. producción**: `NODE_ENV`, bases distintas, `LLM_PROVIDER=fake` solo fuera de
  producción, siembra de ejemplo solo en desarrollo.
- **Integración continua**: GitHub Actions ejecuta lint, tipos, pruebas unitarias/integración (con
  servicio PostgreSQL) y e2e; despliegue automático desde `main` tras CI verde.

## Estrategia de pruebas y trazabilidad

Principios: PostgreSQL real en integración; `FakeLlmProvider` guionizable (respuesta válida,
inválida, vacía, 429, timeout); los datos generados por la simulación **nunca** se usan como
evidencia experimental (Principio V); prueba de contrato contra el proveedor real solo bajo
`LLM_LIVE_TESTS=1`. Cada prueba lleva en su nombre el identificador del requisito que cubre.

| Área | Tipo | Qué se prueba | FR / SC |
|------|------|---------------|---------|
| Motor de reglas | Unitaria | Cada criterio del catálogo: caso válido, inválido y límite (vacío, 4/5/40/41 palabras, términos vagos, acentos, mayúsculas); determinismo | FR-009, FR-010, FR-012, FR-017, FR-019, SC-002 |
| Estado de compuertas | Unitaria | Transiciones y estado derivado (`DESACTUALIZADA`, excepción, `ERROR` no aprueba) | FR-013–FR-016, SC-003 |
| Avance de etapas | Integración | Bloqueo sin compuerta aprobada, avance con aprobación o excepción, orden `PLANNING→TRACKING`, edición de artefacto validado → `NEEDS_CORRECTION` | FR-005, FR-013, FR-014, SC-003 |
| LLM: contrato y errores | Integración (fake) | JSON válido, inválido (reintento de reparación), vacío, 429, timeout, presupuesto agotado; compuerta intacta en todos | FR-020, FR-023, FR-024, SC-009 |
| LLM: seguridad | Integración (fake) | Cadenas de inyección no cambian estados; salida escapada; el agente no escribe artefactos | FR-021, FR-022, FR-023 |
| Registro de IA | Integración | Cada interacción guarda modelo, config, versión de prompt, estado, tokens | FR-025, SC-008 |
| Persistencia | Integración | Creación/lectura/edición de todas las entidades; reinicio del servidor conserva datos; migraciones aplican desde cero | FR-004, FR-034, SC-004 |
| Autenticación | Integración | Registro (duplicado, contraseña débil), login (credenciales erróneas genéricas), logout, límite de intentos, cookie `HttpOnly`/`Secure`, CSRF ausente/erróneo | FR-001, FR-037 |
| Autorización por rol | Integración | Matriz de permisos por rol y por proyecto; mismo usuario con roles distintos; último Facilitador protegido | FR-002, FR-003, SC-005 |
| Aislamiento entre proyectos | Integración | Un usuario no lee ni escribe datos de proyectos ajenos (404) por cada endpoint con `projectId`, incluidos IDs cruzados de otro proyecto en el cuerpo | FR-035, SC-005 |
| Concurrencia | Integración | Dos `PATCH` con la misma versión (uno 409); dos evaluaciones simultáneas con intentos distintos; cambios simultáneos de rol conservan un Facilitador; dos Sprints abiertos imposibles | FR-036, FR-014, SC-003 |
| Exportación | Integración | CSV y JSON coinciden con la API (SC-006); sin correos ni tokens; vacíos permanecen vacíos; ejemplo excluido; fórmulas neutralizadas; Participante recibe 403 | FR-026–FR-030, SC-006, SC-007 |
| Entradas inválidas | Unitaria/Integración | Longitudes, tipos, caracteres especiales, cuerpos mal formados → 422 con mensajes en español, recorriendo todos los endpoints | FR-033 |
| Contrato OpenAPI | Integración | Las respuestas reales de los endpoints principales validan contra `contracts/openapi.yaml` (sin divergencias) | Todos los FR de API |
| Rendimiento (humo) | Carga ligera | ~50 sesiones concurrentes con `fetch`; p95 < 500 ms sin IA; evaluación de compuerta < 1 s | Metas del plan |
| Flujos principales | E2E (Playwright) | Recorrido completo: registro → proyecto → historias → Sprint Goal → evaluación fallida → corrección → aprobación → seguimiento → review → retrospectiva → exportación | SC-001, SC-002, SC-003, SC-006 |
| Asistente en la interfaz | E2E | Pregunta con respuesta etiquetada y aviso; IA caída muestra error y las reglas siguen; no se modifican artefactos | FR-020–FR-024, SC-009 |
| Usabilidad y accesibilidad | E2E + lint | Ancho 375 px sin desplazamiento horizontal; `axe` sin violaciones graves; textos en español | FR-031, FR-032, SC-010 |
| Reproducibilidad | Manual guiado | Ejecutar el quickstart desde cero en otra máquina | SC-011 |

**Defectos críticos**: cualquier fallo en reglas, compuertas, autorización o aislamiento bloquea la
integración (Principio V). La cobertura prioritaria se exige sobre `validation/`, `flow/` y los
guardas de autorización.

### Trazabilidad requisito → módulo

| FR | Módulo(s) | FR | Módulo(s) |
|----|-----------|----|-----------|
| 001 | auth | 021 | agent |
| 002–003 | projects | 022 | agent, frontend (`SourceBadge`) |
| 004 | projects, activity | 023 | validation, flow |
| 005–006 | sprints, frontend | 024, 024a | agent (límites y presupuesto) |
| 007 | frontend | 025 | agent |
| 008 | backlog | 026 | activity, sprints, flow |
| 009–010 | validation, backlog | 027–028 | export |
| 011 | sprints | 029 | export, activity |
| 012–015 | validation, flow | 030 | projects, export |
| 016 | flow | 031–032 | frontend |
| 017 | validation (catálogo) | 033 | shared (Zod), platform |
| 018–019 | artifacts, validation | 034–035 | persistence, projects |
| 020 | agent | 036 | backlog, sprints, artifacts |
| 037 | platform, auth, agent | 038–039 | artifacts |

## Plan de implementación incremental (orientación para `/speckit-tasks`)

Orden sugerido, cada fase demostrable y probada antes de pasar a la siguiente:

1. **Base**: monorepo, configuración, plataforma (config, logger, errores), PostgreSQL y primera
   migración, CI.
2. **Cuentas y proyectos**: `auth`, `projects`, roles por proyecto, autorización y aislamiento
   (US1).
3. **Backlog y evaluación de historias**: `backlog` + motor de reglas `GATE-STORY` (US2).
4. **Sprint Planning y compuerta**: `sprints`, `flow`, `GATE-PLAN`, excepciones, estados (US3).
5. **Agente IA**: servicio LLM, prompts, chat y retroalimentación, límites (US4).
6. **Retrospectiva**: `artifacts`, `GATE-RETRO` (US5).
7. **Registro y exportación**: `activity`, exportación CSV/JSON (US6).
8. **Seguimiento y Review simplificados**: (US7) y pulido de accesibilidad/responsividad.
9. **Despliegue**: contenedor, hosting, secretos, copias, documentación y evidencias del Hito 2.

División sugerida del trabajo entre dos personas: una lleva datos/API/motor (fases 1–4, 6–7) y otra
interfaz y agente (fases 2 (UI), 5, 8), integrando mediante el contrato OpenAPI y los esquemas de
`shared/`. La asignación final corresponde al equipo.

## Complexity Tracking

| Desviación | Por qué es necesaria | Alternativa más simple rechazada porque |
|------------|----------------------|-----------------------------------------|
| Paquete `shared/` (cuarto workspace junto a backend, frontend y e2e) | Compartir esquemas Zod, enums y códigos de error evita duplicar validaciones entre cliente y servidor (DRY) | Duplicar los esquemas en frontend y backend los haría divergir y rompería la trazabilidad entre contrato y validaciones |
| SQL manual dentro de migraciones Prisma | Prisma no expresa índices únicos parciales ni `CHECK`; son necesarios para la integridad (Sprint abierto único, justificación obligatoria) | Validar solo en la aplicación no resiste concurrencia |

Ninguna otra desviación de la Constitución.

## Incertidumbres abiertas

Resumen (detalle en [research.md](research.md#incertidumbres-reales-no-resueltas-sin-inventar-requisitos)):
U-01 modelo concreto de Groq (el proveedor ya está decidido); U-02 cupo real y presupuestos de IA;
U-03 precios y copias del hosting; U-04 calibración de heurísticas y diccionario de términos vagos;
U-05 contraste de referencias con la Scrum Guide 2020; U-06 reidentificación por contexto en
equipos pequeños; U-07 estabilidad de los límites gratuitos y términos de datos de Groq.
