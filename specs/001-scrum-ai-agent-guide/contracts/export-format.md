# Contrato de exportación (CSV y JSON)

**Requisitos**: FR-026 a FR-030, SC-006, SC-007 | **Endpoint**: `GET /api/v1/projects/{projectId}/export` en [openapi.yaml](openapi.yaml)

Solo el Facilitador del proyecto puede exportar. La exportación **no es un análisis**: entrega datos
objetivos registrados para que el experimento (que se realiza fuera de la aplicación) los analice.

## Reglas generales

1. **Seudónimos**: toda persona aparece como `user_pseudonym` (`P-XXXXXX`). Nunca se exportan correo,
   nombre real, hash de contraseña, tokens ni claves.
2. **Sin valores inventados**: lo que no se registró queda vacío (CSV: campo vacío; JSON: `null`).
   No hay estimaciones ni rellenos.
3. **Fechas**: ISO 8601 en UTC con milisegundos (`2026-11-09T14:03:21.123Z`), generadas por el
   servidor. **Duraciones**: enteros en segundos (`*_seconds`), derivados de las marcas de tiempo.
4. **Datos de ejemplo**: el proyecto de ejemplo (`is_sample = true`) se excluye por defecto.
   Con `includeSample=true` se incluye y cada fila lleva `is_sample = true`. Si el resultado queda
   vacío, la API responde 409 (no genera un archivo engañoso).
5. **Contenido libre**: por defecto no se exportan textos escritos por las personas (preguntas y
   respuestas del asistente, contenido de artefactos); con `includeText=true` se añaden las columnas
   marcadas *(texto)*. Motivo: minimizar datos personales.
6. **CSV**: UTF-8 con BOM, separador coma, comillas dobles, saltos de línea `\r\n`, cabecera
   obligatoria. Una solicitud = un conjunto de datos (`dataset`). Las celdas que empiezan por `=`,
   `+`, `-` o `@` se prefijan con `'` (prevención de inyección de fórmulas).
7. **JSON**: un documento con metadatos y un arreglo por conjunto de datos.
8. La exportación se registra en `activity_log` (`export.generated`) con formato y conjunto, sin contenido.

## Metadatos (JSON, y repetidos como columnas donde se indica)

```json
{
  "schema_version": "1.0.0",
  "exported_at": "2026-11-09T14:03:21.123Z",
  "project_id": "uuid",
  "is_sample": false,
  "include_text": false,
  "catalog_version": "1.0.0",
  "datasets": {
    "activities": [], "stage_durations": [], "validation_runs": [],
    "criterion_results": [], "exceptions": [], "agent_interactions": []
  }
}
```

## Conjuntos de datos y columnas

### `activities` (FR-026)
`activity_id, project_id, is_sample, occurred_at, user_pseudonym, action, entity_type, entity_id`

### `stage_durations` (FR-026)
`project_id, is_sample, sprint_number, stage_type, status, started_at, completed_at, duration_seconds`
(`duration_seconds` vacío si la etapa no se completó).

### `validation_runs` (FR-015, FR-026: intentos y resultados)
`validation_id, project_id, is_sample, sprint_number, gate_id, target_type, target_id, target_version, attempt_no, status, passed, mandatory_not_met_count, catalog_version, ai_status, requested_by_pseudonym, started_at, finished_at, duration_ms, has_exception`

`attempts_before_pass` es una columna calculada por `(gate_id, target_id)`: primer `attempt_no`
con `status = PASSED` menos 1 (vacía si nunca se aprobó); se repite en cada fila del mismo objetivo.
Se añade al final de las columnas anteriores.

### `criterion_results` (resultados por criterio)
`validation_id, project_id, is_sample, gate_id, attempt_no, criterion_id, origin, mandatory, outcome, evidence *(texto)*, explanation *(texto)*, recommendation *(texto)*`

### `exceptions` (FR-016)
`exception_id, validation_id, project_id, is_sample, gate_id, authorized_by_pseudonym, created_at, justification *(texto)*`

### `agent_interactions` (FR-025: uso del asistente y versión del modelo)
`interaction_id, project_id, is_sample, created_at, user_pseudonym, kind, validation_id, provider, model, prompt_version, model_config (JSON compacto), status, latency_ms, input_tokens, output_tokens, question *(texto)*, answer *(texto)*`

## Pruebas asociadas

- El 100 % de los registros exportados coincide con lo visible en la aplicación (SC-006): prueba de
  integración que compara exportación con las respuestas de la API.
- Ningún archivo contiene el correo ni un nombre de cuenta: prueba que busca los correos de las
  cuentas de prueba en todas las salidas.
- Valores ausentes permanecen vacíos y el proyecto de ejemplo queda excluido por defecto (SC-007).
- Neutralización de fórmulas en CSV y rechazo de exportación por un Participante (403).
