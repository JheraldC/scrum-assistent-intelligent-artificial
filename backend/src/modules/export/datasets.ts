import type { Db } from '../../platform/db.js';

/** Conjuntos de datos y columnas de la exportación (contracts/export-format.md). */
export const DATASETS = ['activities', 'stage_durations', 'validation_runs', 'criterion_results', 'exceptions', 'agent_interactions'] as const;
export type DatasetName = (typeof DATASETS)[number];

/** Columnas de texto libre: solo se exportan con `includeText=true` (minimiza datos personales). */
const TEXT_COLUMNS: Record<DatasetName, string[]> = {
  activities: [],
  stage_durations: [],
  validation_runs: [],
  criterion_results: ['evidence', 'explanation', 'recommendation'],
  exceptions: ['justification'],
  agent_interactions: ['question', 'answer'],
};

const BASE_COLUMNS: Record<DatasetName, string[]> = {
  activities: ['activity_id', 'project_id', 'is_sample', 'occurred_at', 'user_pseudonym', 'action', 'entity_type', 'entity_id'],
  stage_durations: ['project_id', 'is_sample', 'sprint_number', 'stage_type', 'status', 'started_at', 'completed_at', 'duration_seconds'],
  validation_runs: [
    'validation_id', 'project_id', 'is_sample', 'sprint_number', 'gate_id', 'target_type', 'target_id', 'target_version',
    'attempt_no', 'status', 'passed', 'mandatory_not_met_count', 'catalog_version', 'ai_status', 'requested_by_pseudonym',
    'started_at', 'finished_at', 'duration_ms', 'has_exception', 'attempts_before_pass',
  ],
  criterion_results: ['validation_id', 'project_id', 'is_sample', 'gate_id', 'attempt_no', 'criterion_id', 'origin', 'mandatory', 'outcome'],
  exceptions: ['exception_id', 'validation_id', 'project_id', 'is_sample', 'gate_id', 'authorized_by_pseudonym', 'created_at'],
  agent_interactions: [
    'interaction_id', 'project_id', 'is_sample', 'created_at', 'user_pseudonym', 'kind', 'validation_id', 'provider', 'model',
    'prompt_version', 'model_config', 'status', 'latency_ms', 'input_tokens', 'output_tokens',
  ],
};

export function columnsFor(dataset: DatasetName, includeText: boolean): string[] {
  return includeText ? [...BASE_COLUMNS[dataset], ...TEXT_COLUMNS[dataset]] : BASE_COLUMNS[dataset];
}

export type Row = Record<string, unknown>;

interface Ctx {
  db: Db;
  projectId: string;
  isSample: boolean;
  includeText: boolean;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Quita las columnas de texto libre cuando no se piden, para que nunca viajen por error. */
function pick(row: Row, dataset: DatasetName, includeText: boolean): Row {
  const allowed = new Set(columnsFor(dataset, includeText));
  return Object.fromEntries(Object.entries(row).filter(([k]) => allowed.has(k)));
}

async function sprintNumbers(db: Db, projectId: string): Promise<Map<string, number>> {
  const sprints = await db.sprint.findMany({ where: { projectId }, select: { id: true, number: true } });
  return new Map(sprints.map((s) => [s.id, s.number]));
}

export async function activities(ctx: Ctx): Promise<Row[]> {
  const rows = await ctx.db.activityLog.findMany({
    where: { projectId: ctx.projectId },
    orderBy: { id: 'asc' },
    include: { actor: { select: { pseudonym: true } } },
  });
  return rows.map((r) => ({
    activity_id: Number(r.id),
    project_id: ctx.projectId,
    is_sample: ctx.isSample,
    occurred_at: iso(r.occurredAt),
    user_pseudonym: r.actor?.pseudonym ?? null,
    action: r.action,
    entity_type: r.entityType,
    entity_id: r.entityId,
  }));
}

export async function stageDurations(ctx: Ctx): Promise<Row[]> {
  const stages = await ctx.db.sprintStage.findMany({
    where: { sprint: { projectId: ctx.projectId } },
    include: { sprint: { select: { number: true } } },
    orderBy: [{ sprint: { number: 'asc' } }, { createdAt: 'asc' }],
  });
  const order = ['PLANNING', 'TRACKING', 'REVIEW', 'RETROSPECTIVE'];
  return stages
    .sort((a, b) => a.sprint.number - b.sprint.number || order.indexOf(a.type) - order.indexOf(b.type))
    .map((s) => ({
      project_id: ctx.projectId,
      is_sample: ctx.isSample,
      sprint_number: s.sprint.number,
      stage_type: s.type,
      status: s.status,
      started_at: iso(s.startedAt),
      completed_at: iso(s.completedAt),
      // Duración derivada de las marcas del servidor; vacía si la etapa no se completó (no se inventa).
      duration_seconds: s.startedAt && s.completedAt ? Math.round((s.completedAt.getTime() - s.startedAt.getTime()) / 1000) : null,
    }));
}

/** Estado de IA derivado de la retroalimentación más reciente de cada evaluación. */
async function aiStatusByRun(db: Db, runIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (runIds.length === 0) return map;
  const rows = await db.agentInteraction.findMany({
    where: { validationRunId: { in: runIds }, kind: 'VALIDATION_FEEDBACK' },
    orderBy: { createdAt: 'desc' },
    select: { validationRunId: true, status: true },
  });
  for (const r of rows) if (r.validationRunId && !map.has(r.validationRunId)) map.set(r.validationRunId, r.status === 'RATE_LIMITED' ? 'BUDGET_EXCEEDED' : r.status);
  return map;
}

export async function validationRuns(ctx: Ctx): Promise<Row[]> {
  const runs = await ctx.db.validationRun.findMany({
    where: { projectId: ctx.projectId },
    orderBy: [{ finishedAt: 'asc' }, { attemptNo: 'asc' }],
    include: { results: true, exception: { select: { id: true } }, requester: { select: { pseudonym: true } } },
  });
  const sprints = await sprintNumbers(ctx.db, ctx.projectId);
  const ai = await aiStatusByRun(ctx.db, runs.map((r) => r.id));
  // Intentos antes de aprobar, por (compuerta, objetivo): primer intento PASSED menos 1.
  const firstPass = new Map<string, number>();
  for (const r of runs) {
    const key = `${r.gateId}|${r.targetId}`;
    if (r.status === 'PASSED' && (firstPass.get(key) ?? Infinity) > r.attemptNo) firstPass.set(key, r.attemptNo);
  }
  return runs.map((r) => ({
    validation_id: r.id,
    project_id: ctx.projectId,
    is_sample: ctx.isSample,
    sprint_number: r.targetType === 'SPRINT' || r.targetType === 'RETROSPECTIVE' ? (sprints.get(r.targetId) ?? null) : null,
    gate_id: r.gateId,
    target_type: r.targetType,
    target_id: r.targetId,
    target_version: r.targetVersion,
    attempt_no: r.attemptNo,
    status: r.status,
    passed: r.status === 'PASSED',
    mandatory_not_met_count: r.results.filter((c) => c.mandatory && c.outcome === 'NOT_MET').length,
    catalog_version: r.catalogVersion,
    ai_status: ai.get(r.id) ?? r.aiStatus,
    requested_by_pseudonym: r.requester.pseudonym,
    started_at: iso(r.startedAt),
    finished_at: iso(r.finishedAt),
    duration_ms: r.finishedAt.getTime() - r.startedAt.getTime(),
    has_exception: r.exception !== null,
    attempts_before_pass: firstPass.has(`${r.gateId}|${r.targetId}`) ? (firstPass.get(`${r.gateId}|${r.targetId}`) as number) - 1 : null,
  }));
}

export async function criterionResults(ctx: Ctx): Promise<Row[]> {
  const runs = await ctx.db.validationRun.findMany({
    where: { projectId: ctx.projectId },
    orderBy: [{ finishedAt: 'asc' }, { attemptNo: 'asc' }],
    include: { results: { orderBy: { criterionId: 'asc' } } },
  });
  return runs.flatMap((r) =>
    r.results.map((c) => ({
      validation_id: r.id,
      project_id: ctx.projectId,
      is_sample: ctx.isSample,
      gate_id: r.gateId,
      attempt_no: r.attemptNo,
      criterion_id: c.criterionId,
      origin: c.origin,
      mandatory: c.mandatory,
      outcome: c.outcome,
      evidence: c.evidence,
      explanation: c.explanation,
      recommendation: c.recommendation,
    })),
  );
}

export async function exceptions(ctx: Ctx): Promise<Row[]> {
  const rows = await ctx.db.gateException.findMany({
    where: { run: { projectId: ctx.projectId } },
    orderBy: { createdAt: 'asc' },
    include: { run: { select: { gateId: true } }, authorizer: { select: { pseudonym: true } } },
  });
  return rows.map((e) => ({
    exception_id: e.id,
    validation_id: e.validationRunId,
    project_id: ctx.projectId,
    is_sample: ctx.isSample,
    gate_id: e.run.gateId,
    authorized_by_pseudonym: e.authorizer.pseudonym,
    created_at: iso(e.createdAt),
    justification: e.justification,
  }));
}

export async function agentInteractions(ctx: Ctx): Promise<Row[]> {
  const rows = await ctx.db.agentInteraction.findMany({
    where: { projectId: ctx.projectId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { pseudonym: true } } },
  });
  return rows.map((i) => {
    const response = i.response as { answer?: unknown; summary?: unknown } | null;
    return {
      interaction_id: i.id,
      project_id: ctx.projectId,
      is_sample: ctx.isSample,
      created_at: iso(i.createdAt),
      user_pseudonym: i.user.pseudonym,
      kind: i.kind,
      validation_id: i.validationRunId,
      provider: i.provider,
      model: i.model,
      prompt_version: i.promptVersion,
      model_config: i.modelConfig,
      status: i.status,
      latency_ms: i.latencyMs,
      input_tokens: i.inputTokens,
      output_tokens: i.outputTokens,
      question: i.question,
      answer: typeof response?.answer === 'string' ? response.answer : typeof response?.summary === 'string' ? response.summary : null,
    };
  });
}

const BUILDERS: Record<DatasetName, (ctx: Ctx) => Promise<Row[]>> = {
  activities,
  stage_durations: stageDurations,
  validation_runs: validationRuns,
  criterion_results: criterionResults,
  exceptions,
  agent_interactions: agentInteractions,
};

export async function loadDataset(db: Db, projectId: string, isSample: boolean, dataset: DatasetName, includeText: boolean): Promise<Row[]> {
  const rows = await BUILDERS[dataset]({ db, projectId, isSample, includeText });
  return rows.map((r) => pick(r, dataset, includeText));
}
