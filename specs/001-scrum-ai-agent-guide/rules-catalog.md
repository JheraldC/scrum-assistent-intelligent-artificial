# Catálogo de compuertas y criterios

**Feature**: [spec.md](spec.md) | **Versión del catálogo**: `1.0.0` (borrador de diseño)

Este catálogo define qué se evalúa, con qué método y de dónde viene cada criterio (FR-009, FR-012,
FR-017, FR-019). Es la fuente para el código del motor (`backend/src/modules/validation/catalog/`) y
para las pruebas unitarias. **Todos los criterios aquí listados se evalúan con reglas deterministas**
(Principio III); la IA solo aporta observaciones asesoras que no cambian el resultado.

> **Importante**: "Oficial" significa que el elemento aparece en la Scrum Guide 2020; "Adicional"
> significa que es un criterio de calidad definido por este prototipo y **no** una obligación de
> Scrum. Las referencias se redactan de forma resumida y deben contrastarse con el texto de la guía
> (incertidumbre U-05 en [research.md](research.md)). Cualquier cambio en un criterio, umbral o lista
> de términos incrementa `catalogVersion`.

## Convenciones

- **Resultado por criterio**: `MET` (cumplido), `NOT_MET` (no cumplido) o `NOT_APPLICABLE`
  (no aplica; no cuenta).
- **Obligatorio**: un criterio obligatorio `NOT_MET` hace que la compuerta sea `FAILED`. Un criterio
  no obligatorio solo genera observación y recomendación.
- **Compuerta bloqueante**: solo `GATE-PLAN` y `GATE-RETRO` condicionan una transición
  (ver abajo). `GATE-STORY` y `GATE-REVIEW` evalúan y orientan, pero no bloquean por sí solas.
- **Umbrales iniciales** (calibrables, U-04): palabras = secuencias separadas por espacios; texto
  normalizado en minúsculas, sin tildes ni signos para comparar.
- Cada resultado incluye: `criterionId`, `origin`, `mandatory`, `outcome`, `evidence` (valor o
  fragmento comprobado), `explanation` (si `NOT_MET`) y `recommendation`.

## Por qué solo dos compuertas bloqueantes

La Scrum Guide no impone una secuencia rígida entre eventos. Para no bloquear arbitrariamente el
trabajo (Principio III) el prototipo limita los bloqueos a dos controles **del experimento**:

1. **Iniciar el seguimiento del Sprint** requiere `GATE-PLAN` aprobada (o excepción): un Sprint sin
   objetivo ni trabajo seleccionado es el defecto que el prototipo busca detectar.
2. **Cerrar el Sprint** (retrospectiva validada) requiere `GATE-RETRO` aprobada (o excepción).

El seguimiento, la revisión y la edición del Product Backlog no están bloqueados.

## GATE-STORY — Evaluación de historia / elemento del Product Backlog (no bloqueante)

Objetivo: `BACKLOG_ITEM`. Dimensiones: claridad, coherencia, completitud, verificabilidad (FR-009).

| ID | Criterio | Origen | Oblig. | Dimensión | Método |
|----|----------|--------|--------|-----------|--------|
| STORY-01 | El elemento tiene una descripción (título y texto no vacíos) | Oficial (PBI con descripción) | Sí | Completitud | Campos no vacíos |
| STORY-02 | El elemento tiene un orden/prioridad asignado | Oficial (Product Backlog ordenado) | No | Completitud | `priority` definido |
| STORY-03 | Tipo historia: tiene rol, necesidad y beneficio | Adicional | Sí | Completitud | Los tres campos no vacíos |
| STORY-04 | Tipo historia: tiene al menos 1 criterio de aceptación | Adicional | Sí | Completitud | Cantidad ≥ 1 |
| STORY-05 | Sin términos vagos en título, necesidad y criterios | Adicional | Sí | Verificabilidad | Búsqueda de términos del diccionario `vagos.es` (p. ej. rápido, fácil, intuitivo, mejor, adecuado, etc.) |
| STORY-06 | Cada criterio de aceptación tiene ≥ 5 palabras | Adicional | Sí | Verificabilidad | Conteo de palabras |
| STORY-07 | La necesidad tiene entre 4 y 40 palabras | Adicional | No | Claridad | Conteo de palabras |
| STORY-08 | El beneficio no repite la necesidad | Adicional | No | Coherencia | Similitud de conjuntos de palabras (Jaccard) < 0,8 |

Estado de la evaluación de historia: `PASSED` si todos los criterios obligatorios aplicables son
`MET`; en caso contrario `FAILED`.

## GATE-PLAN — Planificación del Sprint (bloqueante)

Objetivo: `SPRINT`. Bloquea: completar la etapa `PLANNING` y, por tanto, iniciar `TRACKING`.

| ID | Criterio | Origen | Oblig. | Método |
|----|----------|--------|--------|--------|
| PLAN-01 | Existe un Sprint Goal | Oficial (Sprint Goal) | Sí | Texto no vacío |
| PLAN-02 | Hay al menos un elemento del Product Backlog seleccionado | Oficial (Sprint Backlog: elementos seleccionados) | Sí | Cantidad ≥ 1 |
| PLAN-03 | Existe un plan de trabajo registrado | Oficial (Sprint Backlog: plan accionable) | Sí | Texto no vacío |
| PLAN-04 | El Sprint Goal es comprensible: entre 5 y 40 palabras y sin términos vagos | Adicional | Sí | Conteo de palabras + diccionario `vagos.es` |
| PLAN-05 | Coherencia objetivo–trabajo: el objetivo comparte al menos un término significativo con los títulos de los elementos seleccionados | Adicional | Sí | Solapamiento léxico tras quitar palabras vacías (lista `vacias.es`) |
| PLAN-06 | Coherencia trabajo–plan: el plan menciona (por código o por título) cada elemento seleccionado | Adicional | Sí | Búsqueda de código `HU-n` o del título normalizado |
| PLAN-07 | Los elementos de tipo historia seleccionados tienen su última evaluación `PASSED` | Adicional | Sí | Consulta del último `validation_run` de `GATE-STORY` vigente para esa versión |

`NOT_APPLICABLE` en PLAN-07 si no hay historias seleccionadas.

## GATE-REVIEW — Sprint Review (no bloqueante)

Objetivo: `SPRINT_REVIEW`. Todos los criterios son orientativos (FR-039).

| ID | Criterio | Origen | Método |
|----|----------|--------|--------|
| REV-01 | Se registraron resultados del Sprint | Oficial (la Review inspecciona el resultado) | Texto no vacío |
| REV-02 | Se describe el incremento obtenido | Oficial (Incremento) | Texto no vacío |
| REV-03 | Se relaciona el resultado con el Sprint Goal (valoración: logrado / parcial / no logrado, con texto) | Adicional | Valoración definida y texto no vacío |
| REV-04 | Se registró retroalimentación recibida | Oficial (los participantes dan retroalimentación) | Texto no vacío |

## GATE-RETRO — Retrospectiva (bloqueante)

Objetivo: `RETROSPECTIVE`. Bloquea: marcar la retrospectiva `VALIDATED` y cerrar el Sprint.

| ID | Criterio | Origen | Oblig. | Método |
|----|----------|--------|--------|--------|
| RETRO-01 | Se identificó al menos una mejora (acción) | Oficial (la Retrospectiva identifica cambios útiles) | Sí | Cantidad de acciones ≥ 1 |
| RETRO-02 | Hay al menos un aspecto positivo y un problema registrados | Adicional | Sí | Cantidades ≥ 1 |
| RETRO-03 | Cada acción tiene ≥ 5 palabras y no contiene términos vagos | Adicional | Sí | Conteo + diccionario |
| RETRO-04 | Cada acción tiene un responsable (miembro del proyecto) | Adicional | Sí | `owner_id` definido |
| RETRO-05 | Si el Sprint anterior tenía acciones, todas tienen estado de seguimiento actualizado | Adicional | Sí | Estado ≠ `OPEN` sin revisar; `NOT_APPLICABLE` si no hubo acciones previas |
| RETRO-06 | Al menos una acción está marcada para incorporarse al siguiente Sprint | Adicional | No | Marca `for_next_sprint` |

## Observaciones de IA (asesoras)

Para cada evaluación (y bajo demanda en el chat) el agente puede devolver observaciones por
criterio o transversales (ambigüedad, inconsistencia entre artefactos, propuesta de redacción).
No tienen `outcome`, no se cuentan para aprobar y se muestran con la etiqueta **Recomendación de IA**
y el aviso de no garantizado (FR-022 y FR-023 de la spec). Formato en
[contracts/ai-response.schema.json](contracts/ai-response.schema.json).

## Trazabilidad con la spec

| Requisito | Criterios del catálogo |
|-----------|------------------------|
| FR-009, FR-010 | STORY-01…08 |
| FR-011, FR-012, FR-013 | PLAN-01…07 |
| FR-019 | RETRO-01…06 |
| FR-039 | REV-01…04 |
| FR-017 | Campo `origin` de todos los criterios |
