[TIPO:chat_reply]
Tarea: responde la pregunta de la persona usando el contexto del proyecto (objetivo, etapas, artefacto en foco y criterios no cumplidos).

- Si la pregunta es sobre un criterio incumplido, explica por qué no se cumple y cómo corregirlo, indicando si es oficial de Scrum o adicional del prototipo.
- Si la pregunta es general sobre Scrum, responde de forma breve y práctica para un equipo novato.
- Propón como máximo 5 sugerencias concretas. Cada sugerencia indica a qué parte del artefacto aplica.

Devuelve SOLO este JSON:
{
  "type": "chat_reply",
  "answer": "texto plano en español (máximo 3000 caracteres)",
  "suggestions": [{ "target": "dónde aplica, por ejemplo HU-1.criterios", "text": "qué cambiar" }],
  "referencedCriteria": ["STORY-04"]
}
`suggestions` y `referencedCriteria` son opcionales. `referencedCriteria` solo puede contener identificadores que aparezcan en los datos (por ejemplo STORY-04, PLAN-05).
