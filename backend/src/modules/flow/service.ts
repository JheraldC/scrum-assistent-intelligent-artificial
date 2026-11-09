import type { EvaluateRequest, GateId, TargetType } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import { withTransaction, type Db, type Tx } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { ActivityRecorder } from '../activity/index.js';
import { getItemSnapshot } from '../backlog/index.js';
import { CATALOG_VERSION, evaluate, getGate, GATES, type EngineRun } from '../validation/index.js';

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
}

export function toRunDto(run: RunRow) {
  return {
    id: run.id,
    gateId: run.gateId,
    targetType: run.targetType,
    targetId: run.targetId,
    targetVersion: run.targetVersion,
    attemptNo: run.attemptNo,
    status: run.status,
    catalogVersion: run.catalogVersion,
    aiStatus: run.aiStatus,
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
    // Las observaciones de IA se añaden con la historia US4; nunca influyen en el estado.
    aiObservations: [] as unknown[],
    exception: null,
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
}

/** Carga (y bloquea) el objetivo de cada tipo; devuelve null si no existe en el proyecto. */
const LOADERS: Partial<Record<TargetType, (tx: Tx, projectId: string, targetId: string) => Promise<LoadedTarget | null>>> = {
  BACKLOG_ITEM: (tx, projectId, targetId) => getItemSnapshot(tx, projectId, targetId),
};

/**
 * Evalúa una compuerta (FR-012, FR-014, FR-015). En una transacción: bloquea el artefacto,
 * calcula el resultado con el motor puro (sin IA), asigna el intento y guarda resultados.
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
      include: { results: true },
    });
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
    include: { results: true },
    take: 200,
  });
  return runs.map(toRunDto);
}

export async function getRun(db: Db, projectId: string, runId: string) {
  const run = await db.validationRun.findFirst({ where: { id: runId, projectId }, include: { results: true } });
  if (!run) throw AppError.notFound('No se encontró la evaluación.');
  return toRunDto(run);
}
