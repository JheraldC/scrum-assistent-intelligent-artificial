# Diagrama entidad-relación

Detalle de campos y restricciones en [data-model.md](../data-model.md). Se muestran solo las
columnas clave para mantener el diagrama legible.

```mermaid
erDiagram
    USER ||--o{ SESSION : "inicia"
    USER ||--o{ PROJECT_MEMBER : "participa"
    PROJECT ||--o{ PROJECT_MEMBER : "tiene"
    PROJECT ||--o{ BACKLOG_ITEM : "contiene"
    PROJECT ||--o{ SPRINT : "organiza"
    SPRINT ||--|{ SPRINT_STAGE : "4 etapas"
    SPRINT ||--o{ SPRINT_ITEM : "selecciona"
    BACKLOG_ITEM ||--o{ SPRINT_ITEM : "es seleccionado"
    SPRINT_STAGE ||--o{ EVIDENCE : "registra"
    SPRINT ||--o{ TRACKING_ENTRY : "seguimiento"
    SPRINT ||--o| SPRINT_REVIEW : "review"
    SPRINT ||--o| RETROSPECTIVE : "retrospectiva"
    RETROSPECTIVE ||--o{ RETRO_ACTION : "acciones"
    PROJECT ||--o{ VALIDATION_RUN : "evaluaciones"
    VALIDATION_RUN ||--|{ CRITERION_RESULT : "resultados"
    VALIDATION_RUN ||--o| GATE_EXCEPTION : "excepción"
    VALIDATION_RUN ||--o{ AGENT_INTERACTION : "retroalimentación IA"
    PROJECT ||--o{ AGENT_INTERACTION : "interacciones"
    PROJECT ||--o{ ACTIVITY_LOG : "actividad"
    USER ||--o{ RETRO_ACTION : "responsable"

    USER {
        uuid id PK
        text email UK
        text password_hash
        text pseudonym UK
    }
    PROJECT_MEMBER {
        uuid project_id PK
        uuid user_id PK
        enum role "PARTICIPANT|FACILITATOR"
    }
    PROJECT {
        uuid id PK
        text name
        text product_goal
        bool is_sample
    }
    BACKLOG_ITEM {
        uuid id PK
        uuid project_id FK
        text code UK
        enum kind "USER_STORY|ITEM"
        text_array acceptance_criteria
        int priority
        int version
    }
    SPRINT {
        uuid id PK
        uuid project_id FK
        int number
        enum status "OPEN|CLOSED"
        text sprint_goal
        text work_plan
        int version
    }
    SPRINT_STAGE {
        uuid id PK
        uuid sprint_id FK
        enum type "PLANNING|TRACKING|REVIEW|RETROSPECTIVE"
        enum status
        timestamptz started_at
        timestamptz completed_at
    }
    VALIDATION_RUN {
        uuid id PK
        uuid project_id FK
        text gate_id
        enum target_type
        uuid target_id
        int target_version
        int attempt_no
        enum status "PASSED|FAILED|ERROR"
        text catalog_version
        enum ai_status
    }
    CRITERION_RESULT {
        uuid id PK
        uuid validation_run_id FK
        text criterion_id
        enum origin "OFFICIAL|ADDITIONAL"
        enum outcome "MET|NOT_MET|NOT_APPLICABLE"
    }
    GATE_EXCEPTION {
        uuid id PK
        uuid validation_run_id FK
        uuid authorized_by FK
        text justification
    }
    AGENT_INTERACTION {
        uuid id PK
        uuid project_id FK
        uuid validation_run_id FK
        text model
        text prompt_version
        enum status
    }
    ACTIVITY_LOG {
        bigint id PK
        uuid project_id FK
        text action
        timestamptz occurred_at
    }
```

`VALIDATION_RUN.target_id` apunta a `BACKLOG_ITEM`, `SPRINT`, `SPRINT_REVIEW` o `RETROSPECTIVE`
según `target_type` (sin clave foránea, validado por el servicio).
