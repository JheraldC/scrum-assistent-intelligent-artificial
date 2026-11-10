import {
  BacklogItemInputSchema,
  BacklogItemUpdateSchema,
  type SuggestionKind,
  type SuggestionResolve,
  type SuggestionStatus,
} from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import { withTransaction, type Db, type Tx } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { ActivityRecorder } from '../activity/index.js';
import { createItemInTx, nextPriority, updateItemInTx } from '../backlog/index.js';
import { evaluateGate } from '../flow/index.js';
import { createTaskInTx } from '../team/index.js';
import type { Proposal } from './output.js';

/** Datos propuestos por la IA, ya normalizados (lo que se guarda en `ai_suggestion.payload`). */
export interface SuggestionPayload {
  title: string;
  text: string;
  asA?: string;
  iWant?: string;
  soThat?: string;
  acceptanceCriteria: string[];
  itemId: string | null;
  itemCode: string | null;
}

export interface SourceRef {
  document: string;
  section: string | null;
}

interface Row {
  id: string;
  kind: SuggestionKind;
  status: SuggestionStatus;
  payload: unknown;
  sources: unknown;
  targetVersion: number | null;
  createdAt: Date;
  resolvedAt: Date | null;
  appliedEntity: string | null;
  appliedId: string | null;
}

const ACTIONABLE: SuggestionKind[] = ['STORY', 'ACCEPTANCE_CRITERIA', 'TASK'];
export const isActionable = (kind: SuggestionKind) => ACTIONABLE.includes(kind);

function effectOf(kind: SuggestionKind, p: SuggestionPayload, targetVersion: number | null): string {
  switch (kind) {
    case 'STORY':
      return `Se creará la historia «${p.title}» al final del Product Backlog y se evaluará con las reglas (la IA no aprueba nada).`;
    case 'ACCEPTANCE_CRITERIA':
      return p.itemCode
        ? `Se añadirán ${p.acceptanceCriteria.length} criterio(s) de aceptación a ${p.itemCode}${targetVersion ? ` (versión ${targetVersion})` : ''} y se volverá a evaluar con las reglas. Si alguien cambió ese elemento antes, no se sobrescribirá: se le avisará del conflicto.`
        : 'Elija el elemento al que se añadirán los criterios antes de aceptar.';
    case 'TASK':
      return `Se creará la tarea «${p.title}» en el Sprint abierto${p.itemCode ? `, dentro de ${p.itemCode}` : ''}, sin responsable asignado.`;
    default:
      return 'Es solo informativa: aceptarla la marca como revisada y no cambia nada del proyecto.';
  }
}

export function toSuggestionDto(row: Row) {
  const p = row.payload as unknown as SuggestionPayload;
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    actionable: isActionable(row.kind),
    title: p.title,
    text: p.text,
    asA: p.asA ?? null,
    iWant: p.iWant ?? null,
    soThat: p.soThat ?? null,
    acceptanceCriteria: p.acceptanceCriteria,
    itemId: p.itemId,
    itemCode: p.itemCode,
    sources: (row.sources ?? []) as SourceRef[],
    // «DOCUMENTO» solo si hay una cita verificada; si no, es una inferencia de la IA.
    basis: ((row.sources as SourceRef[] | null)?.length ?? 0) > 0 ? ('DOCUMENTO' as const) : ('INFERENCIA' as const),
    effect: effectOf(row.kind, p, row.targetVersion),
    source: 'AI_RECOMMENDATION' as const,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    appliedEntity: row.appliedEntity,
    appliedId: row.appliedId,
  };
}

const clip = (text: string | undefined, max: number) => (text ?? '').trim().slice(0, max);

/**
 * Guarda las propuestas de la IA como sugerencias pendientes. Se descarta lo que no se puede
 * respaldar: códigos de elementos inexistentes se dejan sin destino (la persona elige) y las citas
 * que no corresponden a un documento entregado al modelo se eliminan.
 */
export async function storeProposals(
  db: Db,
  clock: Clock,
  params: {
    projectId: string;
    userId: string;
    interactionId: string;
    proposals: Proposal[];
    /** Documentos y secciones que sí se enviaron al modelo (única base válida para citar). */
    knownSources: { document: string; sections: string[] }[];
    openSprintItemIds: Set<string>;
  },
) {
  if (params.proposals.length === 0) return [];
  const items = await db.backlogItem.findMany({ where: { projectId: params.projectId }, select: { id: true, code: true, version: true } });
  const byCode = new Map(items.map((i) => [i.code.toUpperCase(), i]));
  const rows = [];
  for (const proposal of params.proposals) {
    const target = proposal.itemCode ? byCode.get(proposal.itemCode.trim().toUpperCase()) : undefined;
    // Las tareas solo cuelgan de elementos seleccionados para el Sprint.
    const linked = target && (proposal.kind !== 'TASK' || params.openSprintItemIds.has(target.id)) ? target : undefined;
    const sources = (proposal.sources ?? [])
      .map((s) => {
        const doc = params.knownSources.find((d) => d.document === s.document);
        if (!doc) return null;
        const section = s.section && doc.sections.includes(s.section) ? s.section : null;
        return { document: doc.document, section };
      })
      .filter((s): s is SourceRef => s !== null);
    const title = clip(proposal.title, 200) || clip(proposal.text, 120);
    const payload: SuggestionPayload = {
      title,
      text: clip(proposal.text, 800),
      ...(proposal.asA ? { asA: clip(proposal.asA, 200) } : {}),
      ...(proposal.iWant ? { iWant: clip(proposal.iWant, 500) } : {}),
      ...(proposal.soThat ? { soThat: clip(proposal.soThat, 500) } : {}),
      acceptanceCriteria: (proposal.acceptanceCriteria ?? []).map((c) => clip(c, 300)).filter(Boolean),
      itemId: linked?.id ?? null,
      itemCode: linked?.code ?? null,
    };
    rows.push(
      await db.aiSuggestion.create({
        data: {
          projectId: params.projectId,
          interactionId: params.interactionId,
          askedBy: params.userId,
          kind: proposal.kind,
          payload: payload as unknown as object,
          sources: sources as unknown as object,
          targetVersion: proposal.kind === 'ACCEPTANCE_CRITERIA' ? (linked?.version ?? null) : null,
          createdAt: clock.now(),
        },
      }),
    );
  }
  return rows.map(toSuggestionDto);
}

export async function listSuggestions(db: Db, projectId: string, status?: SuggestionStatus) {
  const rows = await db.aiSuggestion.findMany({
    where: { projectId, ...(status ? { status } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
  });
  return rows.map(toSuggestionDto);
}

interface Applied {
  entity: 'backlog_item' | 'sprint_task' | null;
  id: string | null;
  gateTarget: string | null;
}

async function applyStory(tx: Tx, clock: Clock, userId: string, projectId: string, p: SuggestionPayload): Promise<Applied> {
  const input = BacklogItemInputSchema.parse({
    kind: 'USER_STORY',
    title: p.title,
    asA: p.asA,
    iWant: p.iWant,
    soThat: p.soThat,
    acceptanceCriteria: p.acceptanceCriteria,
    priority: await nextPriority(tx, projectId),
  });
  const item = await createItemInTx(tx, clock, userId, projectId, input);
  return { entity: 'backlog_item', id: item.id, gateTarget: item.id };
}

async function applyCriteria(tx: Tx, clock: Clock, userId: string, projectId: string, p: SuggestionPayload, row: { targetVersion: number | null; payload: unknown }): Promise<Applied> {
  if (!p.itemId) {
    throw AppError.validation('Elija el elemento al que se añadirán los criterios.', [{ field: 'itemId', message: 'Elija el elemento destino.' }]);
  }
  const item = await tx.backlogItem.findFirst({ where: { id: p.itemId, projectId } });
  if (!item) throw AppError.notFound('No se encontró el elemento del Product Backlog.');
  const original = (row.payload as unknown as SuggestionPayload).itemId;
  // Si el destino es el que vio la IA, se exige esa versión: un cambio ajeno produce un conflicto, no una sobrescritura.
  const expectedVersion = original === p.itemId && row.targetVersion ? row.targetVersion : item.version;
  const merged = [...item.acceptanceCriteria, ...p.acceptanceCriteria.filter((c) => !item.acceptanceCriteria.includes(c))];
  const input = BacklogItemUpdateSchema.parse({
    kind: item.kind,
    title: item.title,
    asA: item.asA ?? undefined,
    iWant: item.iWant ?? undefined,
    soThat: item.soThat ?? undefined,
    description: item.description ?? undefined,
    acceptanceCriteria: merged,
    priority: item.priority,
    expectedVersion,
  });
  const updated = await updateItemInTx(tx, clock, userId, projectId, item.id, input);
  return { entity: 'backlog_item', id: updated.id, gateTarget: updated.id };
}

async function applyTask(tx: Tx, clock: Clock, userId: string, projectId: string, p: SuggestionPayload): Promise<Applied> {
  const sprint = await tx.sprint.findFirst({ where: { projectId, status: 'OPEN' } });
  if (!sprint) throw AppError.conflict('No hay un Sprint abierto donde crear la tarea.');
  const task = await createTaskInTx(tx, clock, userId, projectId, sprint.id, { title: p.title, backlogItemId: p.itemId }, { fromAi: true });
  return { entity: 'sprint_task', id: task.id, gateTarget: null };
}

/**
 * Acepta (con edición opcional) o descarta una propuesta. Solo esta acción explícita de una persona
 * puede cambiar un artefacto; usa el control de versión existente y, si cambió un elemento del
 * backlog, lo vuelve a evaluar con las REGLAS (la IA no aprueba compuertas).
 */
export async function resolveSuggestion(
  db: Db,
  clock: Clock,
  userId: string,
  projectId: string,
  suggestionId: string,
  body: SuggestionResolve,
) {
  const outcome = await withTransaction(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ai_suggestion" WHERE id = ${suggestionId}::uuid AND project_id = ${projectId}::uuid FOR UPDATE`;
    const row = await tx.aiSuggestion.findFirst({ where: { id: suggestionId, projectId } });
    if (!row) throw AppError.notFound('No se encontró la sugerencia.');
    if (row.status !== 'PROPOSED') throw AppError.conflict('Esta sugerencia ya fue resuelta.');
    const now = clock.now();

    if (body.action === 'DISCARD') {
      await tx.aiSuggestion.update({ where: { id: row.id }, data: { status: 'DISCARDED', resolvedBy: userId, resolvedAt: now } });
      await ActivityRecorder.record(tx, { projectId, actorId: userId, action: 'suggestion.discarded', entityType: 'ai_suggestion', entityId: row.id, payload: { kind: row.kind, origin: 'AI_SUGGESTION' }, occurredAt: now });
      return { applied: { entity: null, id: null, gateTarget: null } as Applied };
    }

    const stored = row.payload as unknown as SuggestionPayload;
    const edit = body.edit ?? {};
    const payload: SuggestionPayload = {
      ...stored,
      title: edit.title ?? stored.title,
      text: edit.text ?? stored.text,
      asA: edit.asA ?? stored.asA,
      iWant: edit.iWant ?? stored.iWant,
      soThat: edit.soThat ?? stored.soThat,
      acceptanceCriteria: edit.acceptanceCriteria ?? stored.acceptanceCriteria,
      itemId: edit.itemId !== undefined ? edit.itemId : stored.itemId,
    };
    let applied: Applied = { entity: null, id: null, gateTarget: null };
    if (row.kind === 'STORY') applied = await applyStory(tx, clock, userId, projectId, payload);
    else if (row.kind === 'ACCEPTANCE_CRITERIA') applied = await applyCriteria(tx, clock, userId, projectId, payload, row);
    else if (row.kind === 'TASK') applied = await applyTask(tx, clock, userId, projectId, payload);

    await tx.aiSuggestion.update({
      where: { id: row.id },
      data: {
        status: 'ACCEPTED',
        resolvedBy: userId,
        resolvedAt: now,
        appliedEntity: applied.entity,
        appliedId: applied.id,
        payload: payload as unknown as object,
      },
    });
    await ActivityRecorder.record(tx, {
      projectId,
      actorId: userId,
      action: 'suggestion.accepted',
      entityType: 'ai_suggestion',
      entityId: row.id,
      payload: { kind: row.kind, origin: 'AI_SUGGESTION', edited: body.edit !== undefined && Object.keys(body.edit).length > 0 },
      occurredAt: now,
    });
    return { applied };
  });

  const row = await db.aiSuggestion.findUniqueOrThrow({ where: { id: suggestionId } });
  // Revalidación con el motor de reglas (no con IA), a nombre de la persona que aceptó.
  let revalidation: { runId: string; gateId: string; status: string; attemptNo: number } | null = null;
  if (outcome.applied.gateTarget) {
    const run = await evaluateGate(db, clock, userId, projectId, { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: outcome.applied.gateTarget, requestAiFeedback: false });
    revalidation = { runId: run.id, gateId: run.gateId, status: run.status, attemptNo: run.attemptNo };
  }
  return {
    suggestion: toSuggestionDto(row),
    result: { entity: outcome.applied.entity, id: outcome.applied.id },
    revalidation,
    notice: 'Cambio aplicado por una persona a partir de una sugerencia de IA. La IA no aprueba compuertas: solo las reglas lo hacen.',
  };
}
