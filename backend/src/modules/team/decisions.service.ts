import type { DecisionInput } from '@scrum/shared';
import { withTransaction, type Db } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { ActivityRecorder } from '../activity/index.js';

interface DecisionRow {
  id: string;
  kind: 'DECISION' | 'AGREEMENT';
  text: string;
  createdAt: Date;
  creator: { pseudonym: string };
}

export function toDecisionDto(d: DecisionRow) {
  return { id: d.id, kind: d.kind, text: d.text, authorPseudonym: d.creator.pseudonym, createdAt: d.createdAt.toISOString() };
}

const include = { creator: { select: { pseudonym: true } } } as const;

/** Decisiones y acuerdos del proyecto, de la más reciente a la más antigua. */
export async function listDecisions(db: Db, projectId: string) {
  const rows = await db.decision.findMany({ where: { projectId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include, take: 200 });
  return rows.map(toDecisionDto);
}

/** Registro de solo inserción: texto, fecha del servidor y autor. */
export async function addDecision(db: Db, clock: Clock, actorId: string, projectId: string, input: DecisionInput) {
  return withTransaction(db, async (tx) => {
    const now = clock.now();
    const row = await tx.decision.create({ data: { projectId, kind: input.kind, text: input.text, createdBy: actorId, createdAt: now }, include });
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'decision.added',
      entityType: 'decision',
      entityId: row.id,
      payload: { kind: input.kind },
      occurredAt: now,
    });
    return toDecisionDto(row);
  });
}
