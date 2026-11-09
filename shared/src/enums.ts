// Enums compartidos entre backend y frontend (data-model.md, contracts/openapi.yaml).

export const ROLES = ['PARTICIPANT', 'FACILITATOR'] as const;
export type Role = (typeof ROLES)[number];

export const STAGE_TYPES = ['PLANNING', 'TRACKING', 'REVIEW', 'RETROSPECTIVE'] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export const STAGE_STATUSES = ['PENDING', 'IN_PROGRESS', 'NEEDS_CORRECTION', 'VALIDATED'] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const GATE_IDS = ['GATE-STORY', 'GATE-PLAN', 'GATE-REVIEW', 'GATE-RETRO'] as const;
export type GateId = (typeof GATE_IDS)[number];

export const TARGET_TYPES = ['BACKLOG_ITEM', 'SPRINT', 'SPRINT_REVIEW', 'RETROSPECTIVE'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/** Estado derivado de una compuerta para la versión actual del objetivo (no se almacena). */
export const GATE_STATES = [
  'NO_EVALUADA',
  'APROBADA',
  'NO_APROBADA',
  'APROBADA_CON_EXCEPCION',
  'DESACTUALIZADA',
] as const;
export type GateState = (typeof GATE_STATES)[number];

export const ORIGINS = ['OFFICIAL', 'ADDITIONAL'] as const;
export type Origin = (typeof ORIGINS)[number];

export const PROJECT_STATUSES = ['SIN_SPRINT', 'EN_CURSO', 'REQUIERE_CORRECCION', 'CERRADO'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
