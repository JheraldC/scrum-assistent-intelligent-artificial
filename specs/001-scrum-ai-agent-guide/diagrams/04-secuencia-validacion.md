# Secuencia: validación de un artefacto (compuerta de planificación)

Cubre FR-012 a FR-016, FR-023 y FR-024. Punto clave: el resultado de la compuerta se decide y se
guarda **antes** de consultar a la IA; si la IA falla, la evaluación no cambia.

```mermaid
sequenceDiagram
    autonumber
    actor P as Participante
    participant UI as Frontend
    participant API as API (rutas + flow)
    participant ENG as Motor de reglas (puro)
    participant DB as PostgreSQL
    participant AG as Servicio de agente
    participant LLM as Proveedor LLM

    P->>UI: Pulsa "Evaluar planificación"
    UI->>API: POST /projects/{id}/validations (cookie + CSRF)
    API->>API: Autenticación, membresía en el proyecto, validación Zod
    API->>DB: BEGIN; bloquear fila del Sprint; leer instantánea (objetivo, plan, elementos, evaluaciones de historia)
    API->>ENG: evaluate(GATE-PLAN, instantánea)
    ENG-->>API: Resultados por criterio (MET / NOT_MET / NOT_APPLICABLE) + estado
    API->>DB: INSERT validation_run (intento n+1) + criterion_result; actualizar etapa (NEEDS_CORRECTION o sigue); INSERT activity_log
    API->>DB: COMMIT
    alt requestAiFeedback = true
        API->>AG: feedbackForRun(run)
        AG->>AG: Construir contexto acotado al proyecto + datos delimitados; comprobar presupuesto
        AG->>LLM: Solicitud con tiempo límite
        alt Respuesta válida
            LLM-->>AG: JSON estructurado
            AG->>AG: Validar contra el esquema
            AG->>DB: INSERT agent_interaction (modelo, versión de prompt, tokens)
            AG-->>API: Observaciones "Recomendación de IA"
        else Tiempo agotado / error del proveedor / JSON inválido / presupuesto agotado
            LLM--xAG: Fallo
            AG->>DB: INSERT agent_interaction (estado de error)
            AG-->>API: Sin observaciones + aiStatus de error
        end
    end
    API-->>UI: 201 ValidationRun (resultados por reglas + observaciones de IA aparte + aiStatus)
    UI-->>P: Criterios cumplidos / no cumplidos, explicación y recomendaciones<br/>(etiquetas "Comprobación por reglas" y "Recomendación de IA")

    opt Corrección
        P->>UI: Edita el Sprint Goal / plan
        UI->>API: PATCH /sprints/{id} (expectedVersion)
        API->>DB: UPDATE ... WHERE version = expectedVersion (409 si no coincide)
        Note over P,API: La compuerta pasa a DESACTUALIZADA; el Participante vuelve a evaluar (nuevo intento)
    end

    opt Excepción (solo Facilitador, si la evaluación vigente es FAILED)
        P->>UI: Solicita excepción con justificación
        UI->>API: POST /validations/{id}/exception
        API->>DB: INSERT gate_exception + activity_log
        API-->>UI: Avance habilitado y registrado
    end
```
