# Agente inteligente para la guía y validación del proceso Scrum

Prototipo académico que guía a equipos novatos de Scrum por un Sprint completo (planificación,
seguimiento, revisión y retrospectiva), valida sus artefactos con un **motor de reglas determinista**
y ofrece un **asistente de IA** que solo recomienda: la IA nunca decide si una compuerta se aprueba.

La aplicación no ejecuta el experimento de comparación (Scrum tradicional frente a Scrum con IA):
solo **registra y exporta datos objetivos** con seudónimos y sin datos personales para compararlos
fuera de ella.

Se construyó con [GitHub Spec Kit](https://github.com/github/spec-kit). Los documentos de diseño están
en [`specs/001-scrum-ai-agent-guide/`](specs/001-scrum-ai-agent-guide/) y la constitución del proyecto
en [`.specify/memory/constitution.md`](.specify/memory/constitution.md).

## Qué incluye

| Área | Resumen |
|------|---------|
| Cuentas y proyectos | Registro abierto (correo + contraseña), proyectos con roles por proyecto (Facilitador / Participante), aislamiento entre proyectos |
| Flujo del Sprint | Cuatro etapas (planificación, seguimiento, revisión, retrospectiva), un Sprint abierto a la vez, varios Sprints consecutivos |
| Product Backlog | Historias de usuario y otros elementos, evaluación `GATE-STORY` (orientativa) |
| Compuertas | `GATE-PLAN` y `GATE-RETRO` bloquean el avance (con excepción justificada del Facilitador); `GATE-STORY` y `GATE-REVIEW` son orientativas. Cada criterio indica si es **oficial** (Scrum Guide 2020) o **adicional** del prototipo |
| Asistente de IA | Proveedor compatible con OpenAI (Groq, plan gratuito), salida validada, límites de uso, prompts versionados, historial de interacciones |
| Exportación | JSON completo y CSV por conjunto de datos (seudónimos `P-XXXXXX`, sin correos) solo para el Facilitador |

## Requisitos

- Node.js 22 o superior y npm
- PostgreSQL 16 o superior (local o con Docker)
- Git
- Opcional: una clave de API de Groq para probar la IA real (las pruebas automáticas usan una IA simulada)

## Instalación

```bash
git clone https://github.com/JheraldC/scrum-assistent-intelligent-artificial.git
cd scrum-assistent-intelligent-artificial
npm install
cp .env.example .env
```

Edite `.env` (no se versiona):

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Base de desarrollo, p. ej. `postgresql://usuario:clave@localhost:5432/scrum_dev` |
| `TEST_DATABASE_URL` | Base **distinta** para las pruebas (se vacía en cada prueba) |
| `SESSION_SECRET` | Cadena aleatoria de al menos 32 caracteres |
| `CORS_ALLOWED_ORIGINS` | Vacío = mismo origen (recomendado) |
| `LLM_PROVIDER` | `fake` (solo desarrollo y pruebas; **prohibido en producción**) u `openai-compatible` |
| `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL` | Obligatorias con `openai-compatible`; con Groq, `LLM_BASE_URL=https://api.groq.com/openai/v1` |
| `LLM_TIMEOUT_MS`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_TEMPERATURE` | Parámetros del modelo (se registran en cada interacción) |
| `AI_USER_RATE_PER_MINUTE`, `AI_DAILY_TOKEN_BUDGET_GLOBAL`, `AI_DAILY_TOKEN_BUDGET_PER_PROJECT` | Límites de uso; el global debe quedar por debajo del cupo diario de la cuenta del proveedor |

## Ejecución en desarrollo

```bash
docker compose up -d        # PostgreSQL (opcional si ya tiene uno instalado)
npm run db:migrate          # aplica las migraciones a DATABASE_URL
npm run db:seed             # proyecto de ejemplo (solo desarrollo)
npm run dev                 # API en :3000 y web en :5173
```

- Interfaz: <http://localhost:5173> · API: <http://localhost:3000/api/v1>
- Comprobación de salud: `GET /api/v1/health` responde `{"status":"ok"}`.

## Pruebas

```bash
npm run lint
npm run typecheck
npm run test:unit          # motor de reglas, CSV, presupuesto de IA… (sin base de datos)
npm run test:integration   # API contra PostgreSQL real (TEST_DATABASE_URL) con IA simulada
npm run test:e2e           # Playwright: flujo completo en escritorio y móvil
```

- Las pruebas de integración aplican las migraciones a `TEST_DATABASE_URL` por sí solas.
- Playwright usa Edge instalado si se define `PW_CHANNEL=msedge`; si no, el navegador de Playwright.
- Prueba opcional con la IA real (no corre en CI): `LLM_LIVE_TESTS=1 npm run test:integration -- llm-live`.
- Los datos producidos con la IA simulada **no** son evidencia experimental.

## Arquitectura

```
shared/     Esquemas Zod y enumeraciones compartidos por backend y frontend
backend/    Fastify 5 + Prisma 7 (PostgreSQL). Módulos: auth, projects, sprints, backlog,
            validation (motor puro), flow (compuertas y avance), artifacts (seguimiento, Review,
            retrospectiva), agent (IA), export, activity
frontend/   React 19 + Vite + Tailwind 4 + React Router. Textos en español en src/i18n/es.ts
e2e/        Pruebas Playwright por historia de usuario
specs/      Especificación, plan, modelo de datos, catálogo de reglas, contratos y diagramas
```

Decisiones principales:

- **Reglas, no IA, deciden las compuertas.** El motor (`backend/src/modules/validation`) es una función
  pura y versionada (`catalogVersion`); la IA solo añade observaciones etiquetadas como «Recomendación de IA».
- **Control de versiones optimista**: toda edición de artefactos envía `expectedVersion`; ante un cambio
  simultáneo la API responde `409 VERSION_CONFLICT` con el estado actual.
- **Historial de solo inserción** para evaluaciones y actividad (trazabilidad para el experimento).
- **Seguridad**: sesión por cookie opaca (`HttpOnly`, `Secure`, `SameSite`), Argon2id, CSRF con token y
  comprobación de origen, `helmet`, límites de tasa, autorización por proyecto (404 si no es miembro, 403 si
  el rol no alcanza).
- **Privacidad**: seudónimos en la exportación, sin correos, y texto libre solo si se pide expresamente.
- Decisiones registradas en [`docs/decisions/`](docs/decisions/README.md).

## API

Base: `/api/v1`. Contrato completo en [`specs/001-scrum-ai-agent-guide/contracts/openapi.yaml`](specs/001-scrum-ai-agent-guide/contracts/openapi.yaml).

| Recurso | Rutas principales |
|---------|-------------------|
| Cuenta | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/csrf` |
| Proyectos | `GET/POST /projects`, `GET/PATCH /projects/{id}`, `…/members` |
| Sprint | `POST/GET …/sprints`, `PATCH …/sprints/{id}`, `PUT …/items`, `POST …/stages/{etapa}/complete` |
| Artefactos | `…/backlog`, `…/tracking`, `…/review`, `…/retrospective` (+ `/actions`) |
| Compuertas | `GET /criteria-catalog`, `POST/GET …/validations`, `POST …/validations/{id}/exception` |
| Asistente | `POST …/agent/chat`, `GET …/agent/interactions`, `POST …/validations/{id}/ai-feedback` |
| Datos | `GET …/export?format=json\|csv&dataset=…`, `GET …/activity` |

## Despliegue

Una sola imagen sirve la API y la interfaz desde el mismo origen. Vea [`docs/deploy.md`](docs/deploy.md)
(contenedor, variables, migraciones, copias de seguridad y restauración).

```bash
docker build -t scrum-assistant .
docker run -p 3000:3000 --env-file .env.production scrum-assistant
```

## Estructura de datos

Tablas principales: `user`, `session`, `project`, `project_member`, `sprint`, `sprint_stage`, `evidence`,
`activity_log`, `backlog_item`, `validation_run`, `criterion_result`, `sprint_item`, `gate_exception`,
`agent_interaction`, `retrospective`, `retro_action`, `tracking_entry`, `sprint_review`. Detalle y
restricciones en [`specs/001-scrum-ai-agent-guide/data-model.md`](specs/001-scrum-ai-agent-guide/data-model.md);
esquema en [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

## Convenciones

- Los commits no incluyen coautores automáticos.
- Los textos visibles están en español; el código y los identificadores, en inglés.
