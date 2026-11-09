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

/** Las compuertas se añaden a medida que se implementan sus historias (GATE-PLAN, GATE-REVIEW, GATE-RETRO). */
export const GATES: GateDef[] = [
  {
    gateId: 'GATE-STORY',
    title: 'Evaluación de historia o elemento del Product Backlog',
    targetType: 'BACKLOG_ITEM',
    blocking: false,
    criteria: storyCriteria,
  },
];

export function getGate(gateId: GateId): GateDef | undefined {
  return GATES.find((g) => g.gateId === gateId);
}

export type { CriterionDef, GateDef } from './types.js';
