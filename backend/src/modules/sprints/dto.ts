import { STAGE_TYPES, type GateState, type StageStatus, type StageType } from '@scrum/shared';

interface StageRow {
  type: StageType;
  status: StageStatus;
  startedAt: Date | null;
  completedAt: Date | null;
}

interface SprintRow {
  id: string;
  number: number;
  status: 'OPEN' | 'CLOSED';
  sprintGoal: string;
  workPlan: string;
  version: number;
  closedAt: Date | null;
  stages: StageRow[];
}

export interface StageDto {
  type: StageType;
  status: StageStatus;
  startedAt: string | null;
  completedAt: string | null;
  /** Estado derivado de la compuerta de la etapa (solo etapas con compuerta). */
  gateState: GateState | null;
}

export interface SprintDto {
  id: string;
  number: number;
  status: 'OPEN' | 'CLOSED';
  sprintGoal: string;
  workPlan: string;
  version: number;
  itemIds: string[];
  stages: StageDto[];
}

/** Las etapas siempre se devuelven en el orden del flujo (planificación → retrospectiva). */
export function toSprintDto(
  sprint: SprintRow,
  itemIds: string[] = [],
  gateStates: Partial<Record<StageType, GateState>> = {},
): SprintDto {
  const order = new Map(STAGE_TYPES.map((type, index) => [type, index]));
  const stages = [...sprint.stages]
    .sort((a, b) => (order.get(a.type) ?? 0) - (order.get(b.type) ?? 0))
    .map((s) => ({
      type: s.type,
      status: s.status,
      startedAt: s.startedAt?.toISOString() ?? null,
      completedAt: s.completedAt?.toISOString() ?? null,
      gateState: gateStates[s.type] ?? null,
    }));
  return {
    id: sprint.id,
    number: sprint.number,
    status: sprint.status,
    sprintGoal: sprint.sprintGoal,
    workPlan: sprint.workPlan,
    version: sprint.version,
    itemIds,
    stages,
  };
}
