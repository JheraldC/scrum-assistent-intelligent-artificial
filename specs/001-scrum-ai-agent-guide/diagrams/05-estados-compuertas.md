# Estados de las compuertas y de las etapas

Estados y transiciones definidos en [data-model.md](../data-model.md). El estado de compuerta se
**deriva** de la última evaluación y de la versión actual del objetivo; no depende de la IA.

## Compuerta (por objetivo y versión)

```mermaid
stateDiagram-v2
    [*] --> NO_EVALUADA
    NO_EVALUADA --> NO_APROBADA: evaluar → algún criterio obligatorio NOT_MET
    NO_EVALUADA --> APROBADA: evaluar → todos los obligatorios cumplidos
    NO_APROBADA --> DESACTUALIZADA: se edita el artefacto
    APROBADA --> DESACTUALIZADA: se edita el artefacto
    APROBADA_CON_EXCEPCION --> DESACTUALIZADA: se edita el artefacto
    DESACTUALIZADA --> NO_APROBADA: reevaluar (nuevo intento) → falla
    DESACTUALIZADA --> APROBADA: reevaluar (nuevo intento) → aprueba
    NO_APROBADA --> NO_APROBADA: reevaluar sin cambios (nuevo intento)
    NO_APROBADA --> APROBADA_CON_EXCEPCION: Facilitador autoriza excepción justificada
    note right of NO_EVALUADA
        Un error interno del motor (status ERROR) o un fallo
        de la IA nunca llevan a APROBADA.
    end note
```

## Etapa del Sprint

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> IN_PROGRESS: primer registro / iniciar<br/>(TRACKING exige PLANNING validada)
    IN_PROGRESS --> NEEDS_CORRECTION: compuerta bloqueante evaluada como NO_APROBADA
    NEEDS_CORRECTION --> IN_PROGRESS: se edita el artefacto
    IN_PROGRESS --> VALIDATED: completar<br/>(PLANNING/RETROSPECTIVE: compuerta aprobada o con excepción)
    VALIDATED --> NEEDS_CORRECTION: se edita el artefacto de la etapa
    VALIDATED --> [*]: RETROSPECTIVE validada cierra el Sprint
```

Nota: solo `GATE-PLAN` y `GATE-RETRO` bloquean transiciones; `TRACKING` y `REVIEW` se cierran por
decisión del equipo, de modo que no se supone que Scrum obligue a secuenciar todos sus eventos
(ver [rules-catalog.md](../rules-catalog.md)).
