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
| Equipo Scrum | **Responsabilidades** Scrum (Scrum Master, Product Owner, Developers) por proyecto, independientes de los permisos; **vistas** de solo lectura para cada una; Product Goal y **Definition of Done**; **tareas** opcionales del Sprint; **decisiones y acuerdos**; ayudas opcionales para Planning, Daily, Review y Retrospective |
| Documentación | Documentos opcionales por proyecto (`.md`, `.txt`, `.pdf`), con versiones, estado «desactualizado» y control de qué entra al contexto de la IA. Las evidencias de etapa son texto o enlaces (la subida de archivos como evidencia se retiró) |
| Asistente de IA | Proveedor compatible con OpenAI (Groq, plan gratuito), **panel lateral persistente** (cajón en móvil), contexto que crece con los datos del proyecto, citas de documento y sección, **propuestas revisables** (aceptar / editar / descartar), salida validada, límites de uso, prompts versionados e historial de interacciones |
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
| `LLM_TIMEOUT_MS`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_TEMPERATURE` | Parámetros del modelo (se registran en cada interacción). El límite de salida por defecto es 1500: los modelos con razonamiento gastan parte antes de responder |
| `LLM_REASONING_EFFORT` | Opcional (`low`, `medium`, `high`): solo para modelos con razonamiento, p. ej. `openai/gpt-oss-*` en Groq. Con `low` responden más rápido y dejan más tokens para la respuesta |
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
npm run test:e2e           # Playwright: flujo completo en escritorio y móvil (levanta su propio servidor, con IA simulada)
```

- Las pruebas de integración aplican las migraciones a `TEST_DATABASE_URL` por sí solas.
- Playwright usa Edge instalado si se define `PW_CHANNEL=msedge`; si no, el navegador de Playwright.
- Prueba opcional con la IA real (no corre en CI): `LLM_LIVE_TESTS=1 npm run test:integration -- llm-live`.
- Los datos producidos con la IA simulada **no** son evidencia experimental.

## Cómo usar las funciones de equipo y de IA

- **Vistas del equipo** (`Vistas del equipo` en el menú): abren primero la de su responsabilidad. El Facilitador asigna
  responsabilidades en *Participantes*. Son de solo lectura y visibles para todos; no puntúan ni comparan a personas.
- **Definition of Done y Product Goal**: el Facilitador los edita en *Ajustes*. La DoD es opcional.
- **Tareas**: en *Planificación* (y en la vista de Developers). Son opcionales y la asignación también.
- **Documentación**: *Documentación* → el Facilitador sube `.md`/`.txt` (se pueden usar como contexto de IA) o `.pdf` (solo
  referencia: **no se lee su texto**). Máximo 2 MB y 30 documentos por proyecto. Se pueden marcar como desactualizados o
  excluir del contexto.
- **Evidencias**: texto o enlace, con autor, fecha y etapa. Ya no se pueden adjuntar archivos; los adjuntos guardados
  antes de retirar esa función se conservan y se pueden descargar.
- **Evaluar y pedir recomendaciones (panel derecho)**: los botones siguen en cada pantalla.
  - **Evaluar historia / planificación / Review / retrospectiva** ejecuta la validación por reglas (determinista, **sin IA**) y
    muestra el resultado completo en el panel: estado, criterios, evidencia, por qué y cómo corregir. Bajo el formulario queda
    solo un indicador compacto.
  - **Pedir recomendación de IA** envía sola una solicitud contextual (sin copiar ni pegar un prompt) y el panel responde
    **campo por campo**: *cambio recomendado* (con valor actual y propuesto), *sin cambios recomendados*, *sin certeza* o *el
    modelo no se pronunció*. Cada campo indica su respaldo: criterios de las reglas, documento citado o inferencia de la IA.
  - Funciona para historias y elementos del backlog, Product Goal y Definition of Done, planificación, tareas, Review,
    retrospectiva y acciones. El **seguimiento** es un historial sin campos editables: solo recibe un análisis asesor de IA
    (preguntas de facilitación, riesgos). Los artefactos sin reglas se rotulan «análisis asesor de IA», nunca como validación.
  - **Aplicar** una propuesta exige revisar valor actual y propuesto, poder editarlo y confirmar. Se usa el mismo servicio y
    control de versión que una edición manual: si el artefacto cambió, se avisa del conflicto y no se sobrescribe nada. Tras
    aplicar, la pantalla se actualiza y las **reglas** reevalúan; la IA no cambia estados de compuerta ni asigna personas.
  - La conversación se conserva mientras se navega por el proyecto.
- **Asistente**: a la derecha en escritorio (se contrae y se redimensiona arrastrando o con las flechas del teclado); en
  móvil se abre con el botón flotante y se cierra con ✕ o Escape. Cada respuesta indica el contexto usado, cita documento y
  sección cuando se apoya en uno y distingue la inferencia de la IA. **Para responder, el contenido pertinente del proyecto
  se envía al proveedor externo de IA configurado** (nunca de otros proyectos ni credenciales).
- **Propuestas de la IA**: aparecen como tarjetas con su efecto. Nada cambia hasta que una persona elige *Aceptar* o *Editar*
  y confirma. Se registra quién lo aplicó y que el origen fue una sugerencia de IA; el elemento se **reevalúa con las
  reglas** (la IA nunca aprueba compuertas, ni autoriza excepciones, ni asigna personas). Si alguien cambió el elemento
  después de la propuesta, se avisa del conflicto y no se sobrescribe nada.
- Con `LLM_PROVIDER=fake`, escribir `PROPUESTA-IA-SIMULADA` en la pregunta devuelve propuestas de ejemplo (solo pruebas y
  demostraciones; no son evidencia experimental).

## Interfaz

- La explicación de cada pantalla y de cada campo está en un icono **ⓘ**: aparece al pasar el ratón, al enfocarlo con el
  teclado o al tocarlo, y se cierra con Escape. Así las pantallas muestran menos texto fijo.
- Los campos **obligatorios** llevan un asterisco rojo. Si quedan vacíos al salir del campo, o el servidor devuelve un
  error, el borde y el mensaje se muestran en rojo (con icono y texto, no solo color).
- En el asistente, sus mensajes aparecen a la derecha con fondo azul y los de la IA a la izquierda con fondo morado claro;
  los errores, en rojo. **Enter** envía y **Mayús+Enter** inserta un salto de línea.
- El resultado de una evaluación en el panel muestra primero los criterios incumplidos; los cumplidos quedan plegados.
- Varias propuestas de una misma recomendación se pueden aceptar una tras otra: el conflicto se comprueba **por campo**
  (solo bloquea si alguien cambió ese mismo campo entretanto).

## Limitaciones conocidas

- Los **PDF** no se leen: se guardan como referencia y no alimentan a la IA.
- Los archivos se guardan en PostgreSQL (`bytea`): adecuado para este prototipo; con mucho volumen convendría almacenamiento de objetos.
- Solo el **Facilitador** edita el Product Goal / DoD y sube o cambia documentos; una responsabilidad (p. ej. Product Owner) no concede permisos.
- Aún no se ha comprobado la calidad de las propuestas y citas con el proveedor real de IA (tarea T108/T166). Si el modelo
  responde con un formato imperfecto, la aplicación lo sanea (ignora claves desconocidas, recorta, rescata el texto de un JSON
  cortado o usa el texto plano); solo falla si no hay nada utilizable.
- La imagen Docker y el despliegue en producción siguen sin construirse ni ejecutarse: este equipo no tiene Docker (ver `docs/deploy.md`).
- Las pruebas e2e usan su propio servidor (puertos 5273/3100, IA simulada y base de pruebas); si esos puertos están ocupados fallan en lugar de reutilizar el servidor de desarrollo.

## Arquitectura

```
shared/     Esquemas Zod y enumeraciones compartidos por backend y frontend
backend/    Fastify 5 + Prisma 7 (PostgreSQL). Módulos: auth, projects, sprints, backlog,
            validation (motor puro), flow (compuertas y avance), artifacts (seguimiento, Review,
            retrospectiva), team (tareas, decisiones, vistas), documents (documentación), agent (IA y
            sugerencias), export, activity
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
| Equipo | `PUT …/members/{id}/responsibilities`, `GET …/views/{scrum-master\|product-owner\|developers}`, `…/sprints/{id}/tasks`, `…/decisions` |
| Documentación | `…/documents` (+ `/versions`, `/file`), `…/stages/{etapa}/evidence/file` |
| Sugerencias de IA | `GET …/agent/suggestions`, `POST …/agent/suggestions/{id}/resolve` |
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
`agent_interaction`, `retrospective`, `retro_action`, `tracking_entry`, `sprint_review`, `sprint_task`, `decision`,
`project_document`, `project_document_version`, `evidence_attachment`, `ai_suggestion`. Detalle y
restricciones en [`specs/001-scrum-ai-agent-guide/data-model.md`](specs/001-scrum-ai-agent-guide/data-model.md);
esquema en [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

## Convenciones

- Las pruebas e2e nunca reutilizan un servidor ya abierto (podría ser el de desarrollo, con la IA real); `PW_REUSE_SERVER=1` lo permite a propósito.
- Los commits no incluyen coautores automáticos.
- Los textos visibles están en español; el código y los identificadores, en inglés.
