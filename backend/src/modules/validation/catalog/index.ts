import type { GateId } from '@scrum/shared';
import type { CriterionDef, GateDef } from './types.js';

/** Versión del catálogo: cualquier cambio de criterio, umbral o diccionario la incrementa (rules-catalog.md). */
export const CATALOG_VERSION = '1.0.0';

const PBI_NOTE =
  'La Scrum Guide 2020 indica que los elementos del Product Backlog tienen descripción, orden y tamaño.';

const storyCriteria: CriterionDef[] = [
  { id: 'STORY-01', title: 'El elemento tiene una descripción (título y texto)', origin: 'OFFICIAL', mandatory: true, dimension: 'completitud', scrumGuideNote: PBI_NOTE },
  { id: 'STORY-02', title: 'El elemento tiene un orden (prioridad) asignado', origin: 'OFFICIAL', mandatory: false, dimension: 'completitud', scrumGuideNote: PBI_NOTE },
  { id: 'STORY-03', title: 'La historia tiene rol, necesidad y beneficio', origin: 'ADDITIONAL', mandatory: true, dimension: 'completitud' },
  { id: 'STORY-04', title: 'La historia tiene al menos un criterio de aceptación', origin: 'ADDITIONAL', mandatory: true, dimension: 'completitud' },
  { id: 'STORY-05', title: 'No hay términos vagos en el título, la necesidad ni los criterios', origin: 'ADDITIONAL', mandatory: true, dimension: 'verificabilidad' },
  { id: 'STORY-06', title: 'Cada criterio de aceptación tiene al menos 5 palabras', origin: 'ADDITIONAL', mandatory: true, dimension: 'verificabilidad' },
  { id: 'STORY-07', title: 'La necesidad tiene entre 4 y 40 palabras', origin: 'ADDITIONAL', mandatory: false, dimension: 'claridad' },
  { id: 'STORY-08', title: 'El beneficio no repite la necesidad', origin: 'ADDITIONAL', mandatory: false, dimension: 'coherencia' },
];

const SPRINT_BACKLOG_NOTE =
  'La Scrum Guide 2020 describe el Sprint Backlog como el Sprint Goal, los elementos seleccionados del Product Backlog y un plan accionable para entregarlos.';

const planCriteria: CriterionDef[] = [
  { id: 'PLAN-01', title: 'Existe un Sprint Goal', origin: 'OFFICIAL', mandatory: true, scrumGuideNote: SPRINT_BACKLOG_NOTE },
  { id: 'PLAN-02', title: 'Hay al menos un elemento del Product Backlog seleccionado', origin: 'OFFICIAL', mandatory: true, scrumGuideNote: SPRINT_BACKLOG_NOTE },
  { id: 'PLAN-03', title: 'Existe un plan de trabajo registrado', origin: 'OFFICIAL', mandatory: true, scrumGuideNote: SPRINT_BACKLOG_NOTE },
  { id: 'PLAN-04', title: 'El Sprint Goal es comprensible (5 a 40 palabras, sin términos vagos)', origin: 'ADDITIONAL', mandatory: true, dimension: 'claridad' },
  { id: 'PLAN-05', title: 'El Sprint Goal tiene relación con los elementos seleccionados', origin: 'ADDITIONAL', mandatory: true, dimension: 'coherencia' },
  { id: 'PLAN-06', title: 'El plan de trabajo menciona cada elemento seleccionado', origin: 'ADDITIONAL', mandatory: true, dimension: 'coherencia' },
  { id: 'PLAN-07', title: 'Las historias seleccionadas tienen una evaluación aprobada vigente', origin: 'ADDITIONAL', mandatory: true, dimension: 'completitud' },
];

const RETRO_NOTE =
  'La Scrum Guide 2020 indica que la Sprint Retrospective identifica los cambios más útiles para mejorar la efectividad del equipo.';

const retroCriteria: CriterionDef[] = [
  { id: 'RETRO-01', title: 'Se identificó al menos una mejora (acción)', origin: 'OFFICIAL', mandatory: true, scrumGuideNote: RETRO_NOTE },
  { id: 'RETRO-02', title: 'Hay al menos un aspecto positivo y un problema registrados', origin: 'ADDITIONAL', mandatory: true, dimension: 'completitud' },
  { id: 'RETRO-03', title: 'Cada acción tiene al menos 5 palabras y no usa términos vagos', origin: 'ADDITIONAL', mandatory: true, dimension: 'claridad' },
  { id: 'RETRO-04', title: 'Cada acción tiene un responsable', origin: 'ADDITIONAL', mandatory: true, dimension: 'completitud' },
  { id: 'RETRO-05', title: 'Las acciones del Sprint anterior tienen seguimiento actualizado', origin: 'ADDITIONAL', mandatory: true, dimension: 'coherencia' },
  { id: 'RETRO-06', title: 'Al menos una acción está marcada para el siguiente Sprint', origin: 'ADDITIONAL', mandatory: false, dimension: 'completitud' },
];

const REVIEW_NOTE =
  'La Scrum Guide 2020 indica que en la Sprint Review el equipo presenta los resultados a las personas interesadas y se revisa el progreso hacia el Sprint Goal.';

const reviewCriteria: CriterionDef[] = [
  { id: 'REV-01', title: 'Se registraron los resultados del Sprint', origin: 'OFFICIAL', mandatory: true, scrumGuideNote: REVIEW_NOTE },
  { id: 'REV-02', title: 'Se describe el incremento presentado', origin: 'OFFICIAL', mandatory: true, scrumGuideNote: REVIEW_NOTE },
  { id: 'REV-03', title: 'Se valora el avance hacia el Sprint Goal y se explica', origin: 'ADDITIONAL', mandatory: true, dimension: 'coherencia' },
  { id: 'REV-04', title: 'Se registró la retroalimentación recibida', origin: 'OFFICIAL', mandatory: true, scrumGuideNote: REVIEW_NOTE },
];

/** Las compuertas se añaden a medida que se implementan sus historias (GATE-PLAN, GATE-REVIEW, GATE-RETRO). */
export const GATES: GateDef[] = [
  {
    gateId: 'GATE-STORY',
    title: 'Evaluación de historia o elemento del Product Backlog',
    targetType: 'BACKLOG_ITEM',
    blocking: false,
    criteria: storyCriteria,
  },
  {
    gateId: 'GATE-PLAN',
    title: 'Planificación del Sprint',
    targetType: 'SPRINT',
    // Control del prototipo (no una regla de Scrum): bloquea iniciar el seguimiento del Sprint.
    blocking: true,
    criteria: planCriteria,
  },
  {
    gateId: 'GATE-REVIEW',
    title: 'Sprint Review',
    targetType: 'SPRINT_REVIEW',
    // Control orientativo: no bloquea el avance ni admite excepciones.
    blocking: false,
    criteria: reviewCriteria,
  },
  {
    gateId: 'GATE-RETRO',
    title: 'Retrospectiva del Sprint',
    targetType: 'RETROSPECTIVE',
    // Control del prototipo (no una regla de Scrum): bloquea el cierre del Sprint.
    blocking: true,
    criteria: retroCriteria,
  },
];

export function getGate(gateId: GateId): GateDef | undefined {
  return GATES.find((g) => g.gateId === gateId);
}

export type { CriterionDef, GateDef } from './types.js';
