import type { GateId, Origin, TargetType } from '@scrum/shared';

export type Dimension = 'claridad' | 'coherencia' | 'completitud' | 'verificabilidad';

/** Definición de un criterio del catálogo (rules-catalog.md). */
export interface CriterionDef {
  id: string;
  title: string;
  /** OFFICIAL: aparece en la Scrum Guide 2020. ADDITIONAL: criterio de calidad del prototipo. */
  origin: Origin;
  /** Un criterio obligatorio incumplido hace que la compuerta sea FAILED. */
  mandatory: boolean;
  dimension?: Dimension;
  /** Referencia resumida para criterios oficiales (por contrastar con la guía, U-05). */
  scrumGuideNote?: string;
}

export interface GateDef {
  gateId: GateId;
  title: string;
  targetType: TargetType;
  /** Solo GATE-PLAN y GATE-RETRO bloquean transiciones; son controles del prototipo, no reglas de Scrum. */
  blocking: boolean;
  criteria: CriterionDef[];
}
