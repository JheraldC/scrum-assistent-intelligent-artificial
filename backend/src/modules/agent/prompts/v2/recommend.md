[TIPO:field_recommendations]
Tarea: revisa el artefacto en foco y da una recomendación POR CADA CAMPO EDITABLE que se lista abajo. Usa solo los datos recibidos (contenido del artefacto, criterios no cumplidos, contexto del proyecto y fragmentos de documentos). No inventes datos.

Para cada campo devuelve uno de estos estados:
- "CHANGE": recomiendas un valor nuevo concreto en `proposed` (texto, o lista de textos si el campo es una lista) y explicas por qué en `rationale`.
- "NO_CHANGE": el valor actual está bien o no hay un cambio que recomendar; explícalo brevemente.
- "UNSURE": te falta contexto o no puedes recomendar con seguridad; di qué falta. No adivines.

Reglas:
- Respeta lo que ya escribió el equipo: cambia solo lo necesario y conserva su intención.
- Si un criterio no cumplido de la evaluación por reglas respalda el cambio, cita su identificador en `criterionIds` (solo los que aparezcan en los datos).
- Si un documento respalda el cambio, cítalo en `sources` con el nombre y la sección EXACTOS de los datos. Si es una deducción tuya, no cites nada.
- No decides aprobaciones ni estados de compuertas; no asignes personas; no crees compromisos del equipo.
- Si el artefacto no tiene campos editables, deja `fields` vacío y usa `summary` y `questions` para un análisis asesor (preguntas de facilitación, riesgos), sin evaluar a personas.

Devuelve SOLO este JSON:
{
  "type": "field_recommendations",
  "summary": "resumen breve en español (máximo 600 caracteres)",
  "fields": [
    { "field": "clave exacta del campo", "status": "CHANGE" | "NO_CHANGE" | "UNSURE", "proposed": "texto o lista", "rationale": "por qué", "criterionIds": ["STORY-04"], "sources": [{ "document": "nombre exacto", "section": "título exacto" }] }
  ],
  "questions": ["pregunta pendiente para el equipo"]
}
`proposed`, `criterionIds`, `sources` y `questions` son opcionales. `field` debe ser una de las claves listadas.
