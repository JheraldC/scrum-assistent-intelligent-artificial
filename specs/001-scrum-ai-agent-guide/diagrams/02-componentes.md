# Componentes del backend y dependencias entre módulos

Regla de dependencia: **rutas → servicios → dominio/repositorios**. El motor de validación es puro (sin
BD ni LLM). El agente consume resultados de reglas pero no puede cambiarlos. Detalle en
[plan.md](../plan.md#arquitectura-modular).

```mermaid
flowchart TB
    subgraph FE["Frontend (React + TypeScript)"]
        PAG["Pantallas y rutas"] --> COMP["Componentes reutilizables"]
        PAG --> APIC["Cliente API (fetch + CSRF)"]
    end
    SH["shared/: esquemas Zod, enums, tipos"]
    FE -.usa.-> SH

    subgraph BE["Backend (Fastify + TypeScript)"]
        direction TB
        PLAT["platform: config, logger, reloj, errores,<br/>sesión/CSRF, límites de tasa"]
        AUTH["auth<br/>cuentas, sesiones, seudónimos"]
        PROJ["projects<br/>proyectos, miembros y roles"]
        BACK["backlog<br/>Product Backlog e historias"]
        SPR["sprints<br/>Sprint, etapas, evidencia"]
        ART["artifacts<br/>seguimiento, review, retrospectiva"]
        FLOW["flow<br/>orquestación de evaluación y avance"]
        ENG["validation (motor puro)<br/>catálogo + reglas + estado de compuerta"]
        AG["agent<br/>servicio LLM, prompts, validación de salida"]
        ACT["activity<br/>registro de actividad"]
        EXP["export<br/>CSV / JSON"]
        PRISMA["persistence: Prisma / PostgreSQL"]
    end
    APIC -- "HTTP /api/v1" --> AUTH & PROJ & BACK & SPR & ART & FLOW & AG & EXP & ACT

    PROJ --> AUTH
    BACK --> PROJ
    SPR --> PROJ
    ART --> SPR
    FLOW --> ENG
    FLOW --> SPR
    FLOW --> BACK
    FLOW --> ART
    FLOW --> AG
    AG --> ENG
    EXP --> ACT
    AUTH & PROJ & BACK & SPR & ART & FLOW & AG & ACT & EXP --> PRISMA
    BACK & SPR & ART & FLOW & AG & EXP --> ACT
    AG -. "HTTPS" .-> LLM["LlmProvider (openai-compatible → Groq · fake)"]
```

| Módulo | Responsabilidad | Expone a otros módulos |
|--------|-----------------|------------------------|
| `auth` | Registro, login, logout, sesión, CSRF, seudónimo | `requireAuth`, `currentUser` |
| `projects` | Proyectos, miembros, roles por proyecto, estado derivado | `requireProjectRole(roles)` |
| `backlog` | Elementos e historias, orden, versión | `getItemSnapshot` |
| `sprints` | Sprint, selección de elementos, etapas, evidencia | `getSprintSnapshot`, transiciones de etapa |
| `artifacts` | Seguimiento, Review, Retrospectiva y acciones | `getReviewSnapshot`, `getRetroSnapshot` |
| `validation` | Catálogo de criterios, `evaluate(snapshot) → resultados`, estado de compuerta | Funciones puras |
| `flow` | Evaluar compuerta (transacción), conceder excepción, completar etapa | `evaluateGate`, `grantException`, `completeStage` |
| `agent` | Contexto, prompts, llamada al LLM, validación de salida, presupuesto | `chat`, `feedbackForRun` |
| `activity` | Registro de solo inserción | `record(event)` |
| `export` | CSV/JSON sin datos personales | `generate(projectId, options)` |
