# Modelo de datos

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Diagrama ER**: [diagrams/03-entidad-relacion.md](diagrams/03-entidad-relacion.md)

Base de datos PostgreSQL gestionada con Prisma (ver [research.md](research.md) D-01). Convenciones:

- Claves primarias `uuid` (`gen_random_uuid()`), salvo tablas de unión con clave compuesta.
- Fechas `timestamptz` en UTC generadas por el servidor (D-12). Columnas `created_at` en todas las
  tablas; `updated_at` y `version` en los artefactos editables.
- Nombres de tablas y columnas en inglés (`snake_case`) para el código; los textos de interfaz
  están en español. Enums de PostgreSQL con valores en inglés.
- Los textos de usuario se almacenan como `text` con límites impuestos por Zod y por `CHECK`.
- **Aislamiento por proyecto**: toda tabla de negocio contiene `project_id` (directo o por su padre) y
  todas las consultas lo filtran (FR-035).
- No hay entidades de "artefacto genérico": cada artefacto Scrum es una tabla tipada (más simple y
  verificable que una tabla polimórfica); solo las evaluaciones apuntan a un objetivo mediante
  `target_type` + `target_id`.

## Entidades

### user (cuenta)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| email | text | NOT NULL, UNIQUE, guardado en minúsculas, formato validado |
| password_hash | text | NOT NULL (Argon2id) |
| pseudonym | text | NOT NULL, UNIQUE, patrón `^P-[A-Z2-9]{6}$`, inmutable |
| created_at | timestamptz | NOT NULL |

Nunca se exportan `email` ni `password_hash` (FR-028).

### session
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| user_id | uuid | FK → user, ON DELETE CASCADE |
| token_hash | text | NOT NULL, UNIQUE (SHA-256 del token de la cookie) |
| csrf_token_hash | text | NOT NULL |
| expires_at | timestamptz | NOT NULL |
| created_at | timestamptz | NOT NULL |

Índice: `(user_id)`, `(expires_at)` para limpieza.

### project
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| name | text | NOT NULL, 3–100 caracteres |
| description | text | NOT NULL, ≤ 1 000 |
| product_goal | text | NOT NULL, ≤ 500 (objetivo del producto) |
| is_sample | boolean | NOT NULL DEFAULT false (FR-030) |
| version | integer | NOT NULL DEFAULT 1 (bloqueo optimista, FR-036) |
| created_by | uuid | FK → user |
| created_at, updated_at | timestamptz | NOT NULL |

El **estado del proyecto** (FR-004) no se almacena: se deriva del Sprint abierto y del estado de sus
etapas (`SIN_SPRINT`, `EN_CURSO`, `REQUIERE_CORRECCION`, `CERRADO`).

### project_member (roles por proyecto)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| project_id | uuid | PK parte 1, FK → project, ON DELETE CASCADE |
| user_id | uuid | PK parte 2, FK → user |
| role | enum `PARTICIPANT`, `FACILITATOR` | NOT NULL |
| created_at | timestamptz | NOT NULL |

Reglas: un usuario puede tener filas en muchos proyectos con roles distintos (FR-002); **todo
proyecto conserva al menos un `FACILITATOR`** (comprobado en servicio dentro de una transacción
con `SELECT ... FOR UPDATE` de las filas del proyecto, para resistir cambios concurrentes). Índice
`(user_id)` para "mis proyectos".

### backlog_item (Product Backlog; incluye historias de usuario)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| project_id | uuid | FK → project, ON DELETE CASCADE |
| code | text | NOT NULL, UNIQUE (project_id, code), generado `HU-n` / `EL-n` |
| kind | enum `USER_STORY`, `ITEM` | NOT NULL |
| title | text | NOT NULL, ≤ 120 |
| as_a / i_want / so_that | text | NULL permitido solo si `kind='ITEM'` (CHECK) |
| description | text | NULL, ≤ 2 000 (para `ITEM`) |
| acceptance_criteria | text[] | NOT NULL DEFAULT '{}', ≤ 20 elementos, cada uno ≤ 300 |
| priority | integer | NOT NULL, ≥ 1, orden en el backlog |
| version | integer | NOT NULL DEFAULT 1 (bloqueo optimista) |
| created_by | uuid | FK → user |
| created_at, updated_at | timestamptz | NOT NULL |

Índices: `(project_id, priority)`. La evaluación de historia es un `validation_run` (no hay columna de
estado de evaluación: se calcula con la última evaluación y `version`).

### sprint
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| project_id | uuid | FK → project, ON DELETE CASCADE |
| number | integer | NOT NULL, UNIQUE (project_id, number) |
| status | enum `OPEN`, `CLOSED` | NOT NULL DEFAULT 'OPEN' |
| sprint_goal | text | NOT NULL DEFAULT '' (vacío = sin definir), ≤ 500 |
| work_plan | text | NOT NULL DEFAULT '', ≤ 5 000 |
| version | integer | NOT NULL DEFAULT 1 |
| created_at, updated_at, closed_at | timestamptz | `closed_at` NULL mientras esté abierto |

Restricción: **un solo Sprint `OPEN` por proyecto** → índice único parcial
`UNIQUE (project_id) WHERE status = 'OPEN'` (SQL en la migración).

### sprint_item (Sprint Backlog: elementos seleccionados)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| sprint_id | uuid | PK parte 1, FK → sprint, ON DELETE CASCADE |
| backlog_item_id | uuid | PK parte 2, FK → backlog_item |
| created_at | timestamptz | NOT NULL |

Regla de servicio: el elemento y el Sprint deben pertenecer al mismo `project_id`; un elemento no se
selecciona en dos Sprints abiertos.

### sprint_stage (etapas del flujo)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| sprint_id | uuid | FK → sprint, ON DELETE CASCADE |
| type | enum `PLANNING`, `TRACKING`, `REVIEW`, `RETROSPECTIVE` | NOT NULL |
| status | enum `PENDING`, `IN_PROGRESS`, `NEEDS_CORRECTION`, `VALIDATED` | NOT NULL DEFAULT 'PENDING' |
| started_at | timestamptz | NULL hasta pasar a `IN_PROGRESS` |
| completed_at | timestamptz | NULL salvo `VALIDATED` |
| created_at, updated_at | timestamptz | NOT NULL |

`UNIQUE (sprint_id, type)`. Se crean las cuatro filas al crear el Sprint. La duración de la etapa
es `completed_at − started_at`. Las transiciones están en la sección *Estados y transiciones*.

### evidence (evidencia por actividad, FR-006)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| stage_id | uuid | FK → sprint_stage, ON DELETE CASCADE |
| content | text | NOT NULL, 1–2 000 (texto o enlace; no hay subida de archivos en el MVP) |
| created_by | uuid | FK → user |
| created_at | timestamptz | NOT NULL |

### tracking_entry (seguimiento, FR-038)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| sprint_id | uuid | FK → sprint, ON DELETE CASCADE |
| kind | enum `PROGRESS`, `IMPEDIMENT`, `OBSERVATION`, `DAILY_NOTE` | NOT NULL |
| content | text | NOT NULL, 1–2 000 |
| resolved_at | timestamptz | NULL; solo para `IMPEDIMENT` |
| created_by | uuid | FK → user |
| created_at | timestamptz | NOT NULL |

El plan de trabajo se actualiza en `sprint.work_plan` (con control de versión), no aquí.

### sprint_review (FR-039)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| sprint_id | uuid | PK, FK → sprint, ON DELETE CASCADE (una por Sprint) |
| results | text | NOT NULL DEFAULT '' |
| increment | text | NOT NULL DEFAULT '' |
| feedback | text | NOT NULL DEFAULT '' |
| goal_assessment | enum `ACHIEVED`, `PARTIAL`, `NOT_ACHIEVED` | NULL hasta valorar |
| goal_assessment_note | text | NOT NULL DEFAULT '' |
| version | integer | NOT NULL DEFAULT 1 |
| created_at, updated_at | timestamptz | NOT NULL |

### retrospective y retro_action (FR-018, FR-019)
**retrospective**: `sprint_id` PK/FK (una por Sprint), `positives text[]`, `problems text[]`,
`improvements text[]` (oportunidades; NOT NULL DEFAULT '{}'), `version`, `created_at`, `updated_at`.

**retro_action**:
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| sprint_id | uuid | FK → retrospective(sprint_id), ON DELETE CASCADE |
| description | text | NOT NULL, 1–300 |
| owner_id | uuid | FK → user, NULL = sin responsable (se señala en RETRO-04); debe ser miembro del proyecto (servicio) |
| for_next_sprint | boolean | NOT NULL DEFAULT false |
| status | enum `OPEN`, `DONE`, `DISCARDED` | NOT NULL DEFAULT 'OPEN' |
| follow_up_note | text | NOT NULL DEFAULT '' |
| follow_up_updated_at | timestamptz | NULL hasta que alguien actualiza el seguimiento |
| version | integer | NOT NULL DEFAULT 1 (bloqueo optimista, FR-036) |
| created_at | timestamptz | NOT NULL |

RETRO-05 se evalúa sobre las acciones del Sprint anterior: se considera "con seguimiento" si
`follow_up_updated_at` es posterior al inicio del Sprint actual.

### validation_run (evaluación e intento, FR-012, FR-015)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| project_id | uuid | FK → project, ON DELETE CASCADE |
| gate_id | text | NOT NULL, uno de `GATE-STORY`, `GATE-PLAN`, `GATE-REVIEW`, `GATE-RETRO` (CHECK) |
| target_type | enum `BACKLOG_ITEM`, `SPRINT`, `SPRINT_REVIEW`, `RETROSPECTIVE` | NOT NULL |
| target_id | uuid | NOT NULL (sin FK por ser polimórfico; el servicio valida pertenencia al proyecto) |
| target_version | integer | NOT NULL (versión del artefacto evaluada) |
| target_snapshot | jsonb | NOT NULL (contenido evaluado: evidencia y base para la IA) |
| attempt_no | integer | NOT NULL ≥ 1 |
| status | enum `PASSED`, `FAILED`, `ERROR` | NOT NULL |
| catalog_version | text | NOT NULL |
| ai_status | enum `OK`, `NOT_REQUESTED`, `TIMEOUT`, `PROVIDER_ERROR`, `INVALID_RESPONSE`, `BUDGET_EXCEEDED` | NOT NULL |
| requested_by | uuid | FK → user |
| started_at, finished_at | timestamptz | NOT NULL |

`ai_status` se fija al crear la evaluación (`NOT_REQUESTED` salvo que se pida IA en esa misma
solicitud). Como `validation_run` es de solo inserción, la retroalimentación pedida **después** (bajo
demanda, `POST .../validations/{id}/ai-feedback`) no modifica la fila: se guarda como
`agent_interaction` de tipo `VALIDATION_FEEDBACK` ligada a la evaluación y la API deriva `aiStatus`
de la interacción más reciente. No crea un nuevo intento.

`UNIQUE (project_id, gate_id, target_type, target_id, attempt_no)`. `attempt_no` se asigna dentro de
una transacción que bloquea el objetivo (`SELECT ... FOR UPDATE` de la fila del artefacto), de modo que
evaluaciones simultáneas obtienen números distintos y consecutivos. El número de reintentos hasta
aprobar es `attempt_no` de la primera ejecución `PASSED` menos 1. `status='ERROR'` (fallo
interno del motor) **nunca** habilita el avance.

Índices: `(project_id, target_type, target_id, attempt_no DESC)`, `(project_id, finished_at)`.

### criterion_result (resultado por criterio)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| validation_run_id | uuid | FK → validation_run, ON DELETE CASCADE |
| criterion_id | text | NOT NULL (p. ej. `PLAN-05`) |
| origin | enum `OFFICIAL`, `ADDITIONAL` | NOT NULL (FR-017) |
| mandatory | boolean | NOT NULL |
| outcome | enum `MET`, `NOT_MET`, `NOT_APPLICABLE` | NOT NULL |
| evidence | text | NOT NULL DEFAULT '' |
| explanation | text | NOT NULL DEFAULT '' |
| recommendation | text | NOT NULL DEFAULT '' |

`UNIQUE (validation_run_id, criterion_id)`. El método de evaluación de todos los criterios es
determinista, por lo que no se guarda como columna; el catálogo lo declara. Las observaciones de IA
no se guardan aquí sino en `agent_interaction`.

### gate_exception (FR-016)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| validation_run_id | uuid | FK → validation_run, UNIQUE, ON DELETE CASCADE |
| authorized_by | uuid | FK → user (debe ser `FACILITATOR` del proyecto) |
| justification | text | NOT NULL, `CHECK (length(btrim(justification)) >= 10)` |
| created_at | timestamptz | NOT NULL |

Solo se permite sobre un `validation_run` con `status='FAILED'` y vigente (misma `target_version`).

### agent_interaction (FR-020 a FR-025)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | uuid | PK |
| project_id | uuid | FK → project, ON DELETE CASCADE |
| user_id | uuid | FK → user |
| kind | enum `CHAT`, `VALIDATION_FEEDBACK` | NOT NULL |
| validation_run_id | uuid | FK → validation_run, NULL salvo `VALIDATION_FEEDBACK` |
| prompt_version | text | NOT NULL |
| provider | text | NOT NULL |
| model | text | NOT NULL (versión del modelo, FR-025) |
| model_config | jsonb | NOT NULL (temperatura, máximo de salida, timeout) |
| question | text | NOT NULL (vacío para `VALIDATION_FEEDBACK`) |
| response | jsonb | NULL si hubo error; respuesta ya validada |
| status | enum `OK`, `TIMEOUT`, `PROVIDER_ERROR`, `INVALID_RESPONSE`, `BUDGET_EXCEEDED`, `RATE_LIMITED` | NOT NULL |
| latency_ms | integer | NULL si no hubo llamada |
| input_tokens, output_tokens | integer | NULL si no disponibles |
| created_at | timestamptz | NOT NULL |

Índices: `(project_id, created_at)`, `(project_id, user_id, created_at)` (historial y
presupuesto por proyecto), `(created_at)` (presupuesto diario global de tokens: suma de
`input_tokens + output_tokens` del día UTC).

### activity_log (registro de actividades, FR-004, FR-026)
| Campo | Tipo | Restricciones |
|-------|------|---------------|
| id | bigint | PK identidad (orden estable) |
| project_id | uuid | FK → project, ON DELETE CASCADE |
| actor_id | uuid | FK → user, NULL para el sistema |
| action | text | NOT NULL (p. ej. `backlog_item.created`, `stage.completed`, `gate.evaluated`) |
| entity_type | text | NOT NULL |
| entity_id | uuid | NULL |
| payload | jsonb | NOT NULL DEFAULT '{}' (metadatos; sin contenido personal) |
| occurred_at | timestamptz | NOT NULL |

Solo inserción (sin `UPDATE`/`DELETE` en el código; la aplicación usa un rol sin esos permisos
sobre la tabla si la plataforma lo permite). Índice `(project_id, occurred_at, id)`.

## Cardinalidades

- user 1—N project_member N—1 project; user 1—N session.
- project 1—N backlog_item, sprint, validation_run, agent_interaction, activity_log.
- sprint 1—4 sprint_stage; sprint 1—0..1 sprint_review; sprint 1—0..1 retrospective 1—N retro_action;
  sprint 1—N tracking_entry; sprint N—M backlog_item (sprint_item); sprint_stage 1—N evidence.
- validation_run 1—N criterion_result; validation_run 1—0..1 gate_exception;
  validation_run 1—0..N agent_interaction (tipo `VALIDATION_FEEDBACK`).

## Estados y transiciones

### Etapa (`sprint_stage.status`)

| Desde | Evento | Hacia | Condición |
|-------|--------|-------|-----------|
| PENDING | primera edición/registro en la etapa, o `start` | IN_PROGRESS | `TRACKING` solo si `PLANNING` está `VALIDATED` |
| IN_PROGRESS | evaluación de compuerta `FAILED` | NEEDS_CORRECTION | Solo etapas con compuerta bloqueante |
| NEEDS_CORRECTION | edición del artefacto | IN_PROGRESS | — |
| IN_PROGRESS | `complete` | VALIDATED | `PLANNING`: última `GATE-PLAN` vigente `PASSED` o con excepción; `RETROSPECTIVE`: ídem `GATE-RETRO`; `TRACKING` y `REVIEW`: sin compuerta (cierre por el equipo; "validada" significa cerrada) |
| VALIDATED | edición del artefacto de la etapa | NEEDS_CORRECTION | Obliga a reevaluar (edge case de la spec) |

Al pasar `RETROSPECTIVE` a `VALIDATED` el Sprint pasa a `CLOSED` (misma transacción).

### Compuerta (por objetivo y versión)

Estado derivado, no almacenado: `NO_EVALUADA`, `APROBADA`, `NO_APROBADA`, `APROBADA_CON_EXCEPCION`,
`DESACTUALIZADA` (la última evaluación corresponde a una `target_version` anterior). Diagrama en
[diagrams/05-estados-compuertas.md](diagrams/05-estados-compuertas.md). Una respuesta inválida, tiempo agotado o
caída de la IA **no** afecta este estado.

## Reglas de integridad

1. Toda fila de negocio pertenece a exactamente un proyecto; los servicios verifican que los IDs de
   la URL y del cuerpo pertenecen al `project_id` de la ruta.
2. Borrado: no hay borrado de proyectos, Sprints ni evaluaciones en el MVP (conservar el
   historial); las FK con `ON DELETE CASCADE` existen para operaciones de mantenimiento y pruebas.
3. Quitar a un miembro: pierde acceso; sus contribuciones se conservan (FK a `user` sin cascada).
4. `activity_log` y `validation_run` son de solo inserción para la aplicación.
5. Operaciones críticas en una sola transacción: crear Sprint (+4 etapas), seleccionar elementos,
   evaluar compuerta (asignar intento + guardar resultados + actualizar estado de etapa + registrar
   actividad), conceder excepción, cambiar roles (conservando un Facilitador), completar etapa y
   cerrar Sprint. La llamada al LLM se hace **fuera** de la transacción de la evaluación.
6. Datos de ejemplo: `project.is_sample = true`; se crean solo con el script de siembra.

## Estrategia de migraciones

- Una migración Prisma por cambio, nombrada y versionada en `backend/prisma/migrations/`; nunca se
  editan migraciones ya aplicadas.
- SQL manual dentro de la migración para: índice único parcial de Sprint abierto, `CHECK` de
  historias, justificación de excepción y gate ids.
- Desarrollo: `prisma migrate dev`. Producción: `prisma migrate deploy` en el comando de
  arranque/lanzamiento, tras un volcado de seguridad (ver [quickstart.md](quickstart.md)).
- Siembra: `prisma/seed.ts` crea únicamente el proyecto de ejemplo marcado `is_sample` y cuentas de
  demostración **solo en desarrollo**.

## Índices (resumen)

`user(email)` único · `user(pseudonym)` único · `session(token_hash)` único ·
`project_member(user_id)` · `backlog_item(project_id, priority)` · `backlog_item(project_id, code)` único ·
`sprint(project_id, number)` único · `sprint(project_id) WHERE status='OPEN'` único parcial ·
`sprint_stage(sprint_id, type)` único · `validation_run(project_id, target_type, target_id, attempt_no)` único ·
`criterion_result(validation_run_id, criterion_id)` único · `agent_interaction(project_id, user_id, created_at)` ·
`activity_log(project_id, occurred_at, id)`.

## Correspondencia con las entidades de la spec

| Entidad (spec) | Tabla |
|----------------|-------|
| Usuario y Rol en proyecto | `user`, `project_member` |
| Proyecto | `project` |
| Elemento del Product Backlog / Historia | `backlog_item` |
| Sprint, Etapa | `sprint`, `sprint_item`, `sprint_stage` |
| Registro de seguimiento | `tracking_entry` |
| Review y Retrospectiva | `sprint_review`, `retrospective`, `retro_action` |
| Compuerta y Criterio | Catálogo en código ([rules-catalog.md](rules-catalog.md)) + `criterion_result` |
| Evaluación de validación | `validation_run` |
| Excepción manual | `gate_exception` |
| Interacción del agente | `agent_interaction` |
| Exportación | Sin tabla (se genera bajo demanda; se registra en `activity_log`) |

## Mejora 2026-11: entidades añadidas

Migración `20261110061047_responsabilidades_documentos_tareas_sugerencias` (aditiva; valores por defecto compatibles con los datos existentes).

| Entidad | Campos clave | Notas |
|---------|--------------|-------|
| `project.definition_of_done` | texto ≤ 2 000, por defecto `''` | Definition of Done compartida (opcional) |
| `project_member.responsibilities` | lista de `SCRUM_MASTER`, `PRODUCT_OWNER`, `DEVELOPER`, por defecto vacía | Independiente de `role` |
| `sprint_task` | `sprint_id`, `backlog_item_id?`, `title` 1–200, `status` TODO/DOING/DONE, `assignee_id?`, `from_ai`, `version` | Opcional; control de versión |
| `decision` | `project_id`, `kind` DECISION/AGREEMENT, `text` 1–1 000, `created_by`, `created_at` | Solo inserción |
| `project_document` | `project_id`, `name` 1–120, `status` ACTIVE/OUTDATED, `include_in_context`, `current_version` | ≤ 30 por proyecto |
| `project_document_version` | `document_id`, `version`, `file_name`, `mime_type`, `size_bytes` ≤ 2 MB, `data bytea`, `text_content?`, `uploaded_by` | `text_content` solo `.md`/`.txt` |
| `evidence_attachment` | `evidence_id` (PK), `file_name`, `mime_type`, `size_bytes` ≤ 5 MB, `data bytea` | Una por evidencia, opcional |
| `ai_suggestion` | `project_id`, `kind`, `payload`, `sources`, `target_version?`, `status` PROPOSED/ACCEPTED/DISCARDED, `resolved_by?`, `applied_entity?`, `applied_id?` | La IA solo escribe aquí |
