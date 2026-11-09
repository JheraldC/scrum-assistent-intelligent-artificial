import type { EvaluateRequest, GateExceptionInput, GateId, StageType, TargetType } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import { withTransaction, type Db, type Tx } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { latestRuns } from '../../platform/runs.js';
import { ActivityRecorder } from '../activity/index.js';
import { getRetroSnapshot, getReviewSnapshot } from '../artifacts/index.js';
import { getItemSnapshot } from '../backlog/index.js';
import { applyStageEvent, assertTrackingAllowed, getPlanSnapshot, STAGE_GATES } from '../sprints/index.js';
import { CATALOG_VERSION, deriveGateState, evaluate, getGate, GATES, type EngineRun } from '../validation/index.js';

interface RunRow {
  id: string;
  gateId: string;
  targetType: string;
  targetId: string;
  targetVersion: number;
  attemptNo: number;
  status: 'PASSED' | 'FAILED' | 'ERROR';
  catalogVersion: string;
  aiStatus: string;
  startedAt: Date;
  finishedAt: Date;
  results: {
    criterionId: string;
    origin: 'OFFICIAL' | 'ADDITIONAL';
    mandatory: boolean;
    outcome: 'MET' | 'NOT_MET' | 'NOT_APPLICABLE';
    evidence: string;
    explanation: string;
    recommendation: string;
  }[];
  exception: { id: string; justification: string; createdAt: Date; authorizer: { pseudonym: string } } | null;
}

const runInclude = {
  results: true,
  exception: { include: { authorizer: { select: { pseudonym: true } } } },
} as const;

export function toExceptionDto(e: NonNullable<RunRow['exception']>) {
  return {
    id: e.id,
    authorizedByPseudonym: e.authorizer.pseudonym,
    justification: e.justification,
    createdAt: e.createdAt.toISOString(),
  };
}

type AiStatusValue = 'OK' | 'NOT_REQUESTED' | 'TIMEOUT' | 'PROVIDER_ERROR' | 'INVALID_RESPONSE' | 'BUDGET_EXCEEDED';

interface AiInfo {
  aiStatus: AiStatusValue;
  aiObservations: { criterionId: string | null; text: string; suggestedRewrite: string | null; source: 'AI_RECOMMENDATION' }[];
}

/**
 * Estado y observaciones de IA de cada evaluación, derivados de la interacción de
 * retroalimentación más reciente (la evaluación en sí es de solo inserción). Nunca influyen
 * en el estado de la compuerta.
 */
async function aiInfoByRun(db: Tx, runIds: string[]): Promise<Map<string, AiInfo>> {
  const info = new Map<string, AiInfo>();
  if (runIds.length === 0) return info;
  const rows = await db.agentInteraction.findMany({
    where: { validationRunId: { in: runIds }, kind: 'VALIDATION_FEEDBACK' },
    orderBy: { createdAt: 'desc' },
  });
  for (const row of rows) {
    if (!row.validationRunId || info.has(row.validationRunId)) continue;
    const response = row.response as { observations?: { criterionId?: string | null; text: string; suggestedRewrite?: string | null }[] } | null;
    info.set(row.validationRunId, {
      aiStatus: row.status === 'RATE_LIMITED' ? 'BUDGET_EXCEEDED' : row.status,
      aiObservations: (response?.observations ?? []).map((o) => ({
        criterionId: o.criterionId ?? null,
        text: o.text,
        suggestedRewrite: o.suggestedRewrite ?? null,
        source: 'AI_RECOMMENDATION' as const,
      })),
    });
  }
  return info;
}

export function toRunDto(run: RunRow, ai?: AiInfo) {
  return {
    id: run.id,
    gateId: run.gateId,
    targetType: run.targetType,
    targetId: run.targetId,
    targetVersion: run.targetVersion,
    attemptNo: run.attemptNo,
    status: run.status,
    catalogVersion: run.catalogVersion,
    aiStatus: ai?.aiStatus ?? run.aiStatus,
    results: run.results.map((r) => ({
      criterionId: r.criterionId,
      origin: r.origin,
      mandatory: r.mandatory,
      outcome: r.outcome,
      evidence: r.evidence,
      explanation: r.explanation,
      recommendation: r.recommendation,
      source: 'RULE_CHECK' as const, // «Comprobación por reglas» (FR-022)
    })),
    aiObservations: ai?.aiObservations ?? [],
    exception: run.exception ? toExceptionDto(run.exception) : null,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt.toISOString(),
  };
}

export function criteriaCatalog() {
  return {
    catalogVersion: CATALOG_VERSION,
    gates: GATES.map((gate) => ({
      gateId: gate.gateId,
      title: gate.title,
      blocking: gate.blocking,
      criteria: gate.criteria.map((c) => ({
        id: c.id,
        title: c.title,
        origin: c.origin,
        mandatory: c.mandatory,
        dimension: c.dimension ?? null,
        scrumGuideNote: c.scrumGuideNote ?? null,
      })),
    })),
  };
}

interface LoadedTarget {
  version: number;
  snapshot: unknown;
  /** Un Sprint cerrado ya no se evalúa. */
  closed?: boolean;
}

/** Carga (y bloquea) el objetivo de cada tipo; devuelve null si no existe en el proyecto. */
const LOADERS: Partial<Record<TargetType, (tx: Tx, projectId: string, targetId: string) => Promise<LoadedTarget | null>>> = {
  BACKLOG_ITEM: (tx, projectId, targetId) => getItemSnapshot(tx, projectId, targetId),
  SPRINT: async (tx, projectId, targetId) => {
    const plan = await getPlanSnapshot(tx, projectId, targetId);
    return plan ? { version: plan.version, snapshot: plan.snapshot, closed: plan.status === 'CLOSED' } : null;
  },
  SPRINT_REVIEW: (tx, projectId, targetId) => getReviewSnapshot(tx, projectId, targetId),
  RETROSPECTIVE: (tx, projectId, targetId) => getRetroSnapshot(tx, projectId, targetId),
};

/** Etapa cuyo estado depende del resultado de una compuerta. */
function stageForGate(gateId: GateId): StageType | undefined {
  return (Object.entries(STAGE_GATES) as [StageType, { gateId: GateId }][]).find(([, g]) => g.gateId === gateId)?.[0];
}

/**
 * Evalúa una compuerta (FR-012, FR-014, FR-015). En una transacción: bloquea el artefacto,
 * calcula el resultado con el motor puro (sin IA), asigna el intento, guarda resultados y
 * actualiza el estado de la etapa asociada.
 */
export async function evaluateGate(db: Db, clock: Clock, actorId: string, projectId: string, request: EvaluateRequest) {
  const gate = getGate(request.gateId);
  if (!gate) throw AppError.validation('Esta compuerta aún no está disponible.');
  if (gate.targetType !== request.targetType) {
    throw AppError.validation(`La compuerta ${gate.gateId} no se aplica a ese tipo de objetivo.`);
  }
  const loader = LOADERS[gate.targetType];
  if (!loader) throw AppError.validation('Ese tipo de objetivo aún no se puede evaluar.');

  return withTransaction(db, async (tx) => {
    const target = await loader(tx, projectId, request.targetId);
    if (!target) throw AppError.notFound('No se encontró el elemento que se quiere evaluar.');
    if (target.closed) throw AppError.conflict('El Sprint está cerrado: ya no se puede evaluar.');

    const startedAt = clock.now();
    const run: EngineRun = evaluate(gate.gateId as GateId, target.snapshot as never);
    const last = await tx.validationRun.aggregate({
      where: { projectId, gateId: gate.gateId, targetType: gate.targetType, targetId: request.targetId },
      _max: { attemptNo: true },
    });
    const finishedAt = clock.now();

    const saved = await tx.validationRun.create({
      data: {
        projectId,
        gateId: gate.gateId,
        targetType: gate.targetType,
        targetId: request.targetId,
        targetVersion: target.version,
        targetSnapshot: target.snapshot as object,
        attemptNo: (last._max.attemptNo ?? 0) + 1,
        status: run.status,
        catalogVersion: CATALOG_VERSION,
        aiStatus: 'NOT_REQUESTED',
        requestedBy: actorId,
        startedAt,
        finishedAt,
        results: { create: run.results },
      },
      include: runInclude,
    });

    // El resultado de la compuerta mueve la etapa asociada (planificación → requiere corrección o sigue).
    const stageType = stageForGate(gate.gateId as GateId);
    if (stageType) {
      const stage = await tx.sprintStage.findUniqueOrThrow({ where: { sprintId_type: { sprintId: request.targetId, type: stageType } } });
      if (run.status === 'PASSED') await applyStageEvent(tx, clock, request.targetId, stageType, 'gate_passed');
      else if (stage.status === 'VALIDATED') await applyStageEvent(tx, clock, request.targetId, stageType, 'edit');
      else await applyStageEvent(tx, clock, request.targetId, stageType, 'gate_failed');
    }

    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'gate.evaluated',
      entityType: 'validation_run',
      entityId: saved.id,
      payload: { gate: gate.gateId, attempt: saved.attemptNo, status: saved.status },
      occurredAt: finishedAt,
    });
    return toRunDto(saved);
  });
}

export async function listRuns(db: Db, projectId: string, filter: { targetType?: TargetType; targetId?: string }) {
  const runs = await db.validationRun.findMany({
    where: { projectId, ...filter },
    orderBy: [{ finishedAt: 'desc' }, { attemptNo: 'desc' }],
    include: runInclude,
    take: 200,
  });
  const ai = await aiInfoByRun(db, runs.map((r) => r.id));
  return runs.map((r) => toRunDto(r, ai.get(r.id)));
}

export async function getRun(db: Db, projectId: string, runId: string) {
  const run = await db.validationRun.findFirst({ where: { id: runId, projectId }, include: runInclude });
  if (!run) throw AppError.notFound('No se encontró la evaluación.');
  return toRunDto(run, (await aiInfoByRun(db, [run.id])).get(run.id));
}

// ---------------------------------------------------------------------------------------------
// Excepciones manuales (FR-016)
// ---------------------------------------------------------------------------------------------

async function currentVersion(tx: Tx, targetType: TargetType, targetId: string): Promise<number | null> {
  if (targetType === 'SPRINT') return (await tx.sprint.findUnique({ where: { id: targetId } }))?.version ?? null;
  if (targetType === 'SPRINT_REVIEW') return (await tx.sprintReview.findUnique({ where: { sprintId: targetId } }))?.version ?? null;
  if (targetType === 'RETROSPECTIVE') return (await tx.retrospective.findUnique({ where: { sprintId: targetId } }))?.version ?? null;
  return null;
}

/**
 * Concede una excepción justificada sobre la evaluación vigente FAILED de una compuerta bloqueante.
 * Solo la concede un Facilitador (la ruta lo exige); queda registrada con autor, fecha y motivo.
 */
export async function grantException(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  runId: string,
  input: GateExceptionInput,
) {
  return withTransaction(db, async (tx) => {
    const run = await tx.validationRun.findFirst({ where: { id: runId, projectId }, include: { exception: true } });
    if (!run) throw AppError.notFound('No se encontró la evaluación.');
    const gate = getGate(run.gateId as GateId);
    if (!gate?.blocking) throw AppError.conflict('Esta compuerta no bloquea el avance, así que no necesita una excepción.');
    if (run.status !== 'FAILED') throw AppError.conflict('Solo se puede conceder una excepción sobre una evaluación no aprobada.');
    if (run.exception) throw AppError.conflict('Esta evaluación ya tiene una excepción registrada.');

    // Debe ser la evaluación vigente: el último intento y sobre la versión actual del objetivo.
    const latest = (await latestRuns(tx, projectId, run.targetType, [run.targetId])).get(run.targetId);
    const version = await currentVersion(tx, run.targetType, run.targetId);
    if (!latest || latest.id !== run.id || version !== run.targetVersion) {
      throw AppError.conflict('La evaluación está desactualizada: evalúe de nuevo antes de pedir una excepción.');
    }

    const now = clock.now();
    const created = await tx.gateException.create({
      data: { validationRunId: run.id, authorizedBy: actorId, justification: input.justification, createdAt: now },
      include: { authorizer: { select: { pseudonym: true } } },
    });
    const stageType = stageForGate(gate.gateId);
    if (stageType) await applyStageEvent(tx, clock, run.targetId, stageType, 'gate_passed');
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'gate.exception_granted',
      entityType: 'validation_run',
      entityId: run.id,
      payload: { gate: gate.gateId, attempt: run.attemptNo },
      occurredAt: now,
    });
    return toExceptionDto(created);
  });
}

// ---------------------------------------------------------------------------------------------
// Avance de etapas (FR-013)
// ---------------------------------------------------------------------------------------------

/**
 * Completa una etapa. Las etapas con compuerta bloqueante exigen una evaluación vigente aprobada
 * o con excepción; el seguimiento exige la planificación validada (controles del prototipo).
 */
export async function completeStage(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  sprintId: string,
  stageType: StageType,
) {
  return withTransaction(db, async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "sprint" WHERE id = ${sprintId}::uuid AND project_id = ${projectId}::uuid FOR UPDATE`;
    if (locked.length === 0) throw AppError.notFound('No se encontró el Sprint.');
    const sprint = await tx.sprint.findUniqueOrThrow({ where: { id: sprintId } });
    if (sprint.status === 'CLOSED') throw AppError.conflict('El Sprint está cerrado.');
    const stage = await tx.sprintStage.findUniqueOrThrow({ where: { sprintId_type: { sprintId, type: stageType } } });

    if (stageType === 'TRACKING') await assertTrackingAllowed(tx, sprintId);
    if (stage.status === 'VALIDATED') throw AppError.conflict('La etapa ya está validada.');

    const gate = STAGE_GATES[stageType];
    if (gate) {
      const run = (await latestRuns(tx, projectId, gate.targetType, [sprintId])).get(sprintId);
      const version = (await currentVersion(tx, gate.targetType, sprintId)) ?? sprint.version;
      const state = deriveGateState(
        run ? { status: run.status, targetVersion: run.targetVersion, hasException: run.hasException } : null,
        version,
      );
      if (state !== 'APROBADA' && state !== 'APROBADA_CON_EXCEPCION') {
        const what = stageType === 'PLANNING' ? 'La planificación' : 'La retrospectiva';
        throw new AppError(
          'GATE_NOT_PASSED',
          409,
          state === 'DESACTUALIZADA'
            ? `${what} cambió después de la última evaluación. Evalúela de nuevo antes de avanzar.`
            : `${what} aún no cumple los criterios obligatorios. Corrija y evalúe de nuevo, o pida una excepción al Facilitador.`,
        );
      }
    }

    if (stage.status === 'PENDING') await applyStageEvent(tx, clock, sprintId, stageType, 'start');
    const completed = await applyStageEvent(tx, clock, sprintId, stageType, 'complete');
    if (!completed) throw new AppError('STAGE_ORDER', 409, 'La etapa no se puede completar en su estado actual.');

    const now = clock.now();
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'stage.completed',
      entityType: 'sprint_stage',
      entityId: completed.id,
      payload: { stage: stageType },
      occurredAt: now,
    });
    // Al validar la retrospectiva el Sprint se cierra en la misma operación (permite crear el siguiente).
    if (stageType === 'RETROSPECTIVE') {
      await tx.sprint.update({ where: { id: sprintId }, data: { status: 'CLOSED', closedAt: now, updatedAt: now } });
      await ActivityRecorder.record(tx, {
        projectId,
        actorId,
        action: 'sprint.closed',
        entityType: 'sprint',
        entityId: sprintId,
        payload: { number: sprint.number },
        occurredAt: now,
      });
    }
    return {
      type: completed.type,
      status: completed.status,
      startedAt: completed.startedAt?.toISOString() ?? null,
      completedAt: completed.completedAt?.toISOString() ?? null,
    };
  });
}
