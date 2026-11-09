[TIPO:validation_feedback]
Tarea: a partir del artefacto evaluado y de los resultados de las reglas, escribe observaciones asesoras que ayuden a mejorarlo. Tus observaciones NO cambian el resultado de la evaluación.

- Señala ambigüedades, omisiones o inconsistencias que las reglas no puedan ver (por ejemplo, un objetivo que no corresponde con las historias elegidas).
- Cuando convenga, propón una redacción mejorada en `suggestedRewrite`.
- Si una observación se refiere a un criterio concreto, indica su identificador; si es general, usa null.
- Máximo 15 observaciones, claras y accionables.

Devuelve SOLO este JSON:
{
  "type": "validation_feedback",
  "summary": "resumen breve (opcional)",
  "observations": [
    { "criterionId": "PLAN-05", "text": "observación", "suggestedRewrite": "texto sugerido o null" }
  ]
}
