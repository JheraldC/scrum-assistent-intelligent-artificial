import {
  BacklogItemInputSchema,
  BacklogItemUpdateSchema,
  ProjectUpdateSchema,
  RetrospectiveUpdateSchema,
  SprintReviewUpdateSchema,
  SprintUpdateSchema,
  type ArtifactType,
  type GateId,
  type SuggestionKind,
  type SuggestionResolve,
  type SuggestionStatus,
  type TargetType,
} from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import { joinTransaction, withTransaction, type Db, type Tx } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { ActivityRecorder } from '../activity/index.js';
import { updateReview, updateRetrospective, updateAction } from '../artifacts/index.js';
import { createItemInTx, nextPriority, updateItemInTx } from '../backlog/index.js';
import { updateProject } from '../projects/index.js';
import { updateSprint } from '../sprints/index.js';
import { evaluateGate } from '../flow/index.js';
import { createTaskInTx, updateTask } from '../team/index.js';
import type { ArtifactField, FieldValue } from './artifacts.js';
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
  /** Solo en propuestas FIELD_CHANGE: el campo de un artefacto y su valor actual y propuesto. */
  change?: FieldChange;
}

export interface FieldChange {
  artifactType: ArtifactType;
  artifactId: string;
  artifactLabel: string;
  field: string;
  fieldLabel: string;
  fieldKind: 'text' | 'list';
  currentValue: FieldValue;
  proposedValue: FieldValue;
  rationale: string;
  basis: 'REGLAS' | 'DOCUMENTO' | 'INFERENCIA';
  criterionIds: string[];
  hasRules: boolean;
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

const ACTIONABLE: SuggestionKind[] = ['STORY', 'ACCEPTANCE_CRITERIA', 'TASK', 'FIELD_CHANGE'];
export const isActionable = (kind: SuggestionKind) => ACTIONABLE.includes(kind);

function effectOf(kind: SuggestionKind, p: SuggestionPayload): string {
  switch (kind) {
    case 'STORY':
      return `Se creará la historia «${p.title}» al final del Product Backlog y se evaluará con las reglas (la IA no aprueba nada).`;
    case 'ACCEPTANCE_CRITERIA':
      return p.itemCode
        ? `Se añadirán ${p.acceptanceCriteria.length} criterio(s) de aceptación a ${p.itemCode} (se suman a los que ya tenga) y se volverá a evaluar con las reglas.`
        : 'Elija el elemento al que se añadirán los criterios antes de aceptar.';
    case 'TASK':
      return `Se creará la tarea «${p.title}» en el Sprint abierto${p.itemCode ? `, dentro de ${p.itemCode}` : ''}, sin responsable asignado.`;
    case 'FIELD_CHANGE':
      return p.change
        ? `Se reemplazará «${p.change.fieldLabel}» de ${p.change.artifactLabel} por el valor propuesto${p.change.hasRules ? ' y se volverá a evaluar con las reglas' : ''}. Si ese campo cambió entretanto, no se sobrescribe.`
        : 'Se reemplazará el valor del campo por el propuesto.';
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
    basis: p.change ? p.change.basis : ((row.sources as SourceRef[] | null)?.length ?? 0) > 0 ? ('DOCUMENTO' as const) : ('INFERENCIA' as const),
    change: p.change ?? null,
    effect: effectOf(row.kind, p),
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

interface GateRef {
  gateId: GateId;
  targetType: TargetType;
  targetId: string;
}

interface Applied {
  entity: 'backlog_item' | 'sprint_task' | 'artifact' | null;
  id: string | null;
  gate: GateRef | null;
}

const STORY_GATE = (id: string): GateRef => ({ gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: id });

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
  return { entity: 'backlog_item', id: item.id, gate: STORY_GATE(item.id) };
}

async function applyCriteria(tx: Tx, clock: Clock, userId: string, projectId: string, p: SuggestionPayload): Promise<Applied> {
  if (!p.itemId) {
    throw AppError.validation('Elija el elemento al que se añadirán los criterios.', [{ field: 'itemId', message: 'Elija el elemento destino.' }]);
  }
  const item = await tx.backlogItem.findFirst({ where: { id: p.itemId, projectId } });
  if (!item) throw AppError.notFound('No se encontró el elemento del Product Backlog.');
  // Añadir criterios es una fusión con los vigentes (no reemplaza nada), así que se aplica sobre la versión actual:
  // se conservan los cambios que otra persona haya hecho entretanto y se pueden aceptar varias propuestas seguidas.
  const expectedVersion = item.version;
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
  return { entity: 'backlog_item', id: updated.id, gate: STORY_GATE(updated.id) };
}

async function applyTask(tx: Tx, clock: Clock, userId: string, projectId: string, p: SuggestionPayload): Promise<Applied> {
  const sprint = await tx.sprint.findFirst({ where: { projectId, status: 'OPEN' } });
  if (!sprint) throw AppError.conflict('No hay un Sprint abierto donde crear la tarea.');
  const task = await createTaskInTx(tx, clock, userId, projectId, sprint.id, { title: p.title, backlogItemId: p.itemId }, { fromAi: true });
  return { entity: 'sprint_task', id: task.id, gate: null };
}

const asList = (value: FieldValue): string[] => (Array.isArray(value) ? value : value.split('\n')).map((v) => v.trim()).filter(Boolean);
const asText = (value: FieldValue): string => (Array.isArray(value) ? value.join('\n') : value).trim();

/**
 * Aplica el nuevo valor de UN campo con el servicio normal del artefacto (mismos controles y el mismo
 * control de versión que una edición manual). Si el artefacto cambió desde la propuesta, el servicio
 * responde 409 VERSION_CONFLICT y no se sobrescribe nada.
 */
async function applyFieldChange(
  tx: Tx,
  clock: Clock,
  userId: string,
  projectId: string,
  row: { targetVersion: number | null },
  p: SuggestionPayload,
  edited: FieldValue | undefined,
): Promise<Applied> {
  const change = p.change;
  if (!change) throw AppError.validation('La propuesta no tiene un campo destino.');
  const value = edited ?? change.proposedValue;
  const db = joinTransaction(tx);
  const { artifactType: type, artifactId: id, field } = change;
  const text = asText(value);
  const list = asList(value);
  const gate = (gateId: GateId, targetType: TargetType, targetId: string): GateRef => ({ gateId, targetType, targetId });
  const done = (g: GateRef | null): Applied => ({ entity: 'artifact', id, gate: g });
  /**
   * Conflicto POR CAMPO: si el artefacto cambió desde la propuesta pero ESTE campo sigue igual que cuando
   * se recomendó, se aplica sobre la versión vigente (así se pueden aceptar varias propuestas seguidas del
   * mismo artefacto). Solo si alguien cambió este mismo campo se responde 409 y no se sobrescribe nada.
   */
  const norm = (v: FieldValue | null | undefined) => JSON.stringify(Array.isArray(v) ? v.map((x) => x.trim()).filter(Boolean) : (v ?? '').trim());
  const version = (current: number, currentValue: FieldValue | null | undefined) => {
    if (row.targetVersion === null || row.targetVersion === current) return current;
    if (norm(currentValue) === norm(change.currentValue)) return current;
    throw new AppError('VERSION_CONFLICT', 409, `«${change.fieldLabel}» cambió después de la recomendación. No se sobrescribió nada; pida una recomendación nueva o descarte esta.`, undefined, {
      current: { field, value: currentValue ?? '' },
    });
  };

  switch (type) {
    case 'BACKLOG_ITEM': {
      const item = await tx.backlogItem.findFirst({ where: { id, projectId } });
      if (!item) throw AppError.notFound('No se encontró el elemento del Product Backlog.');
      const input = BacklogItemUpdateSchema.parse({
        kind: item.kind,
        title: field === 'title' ? text : item.title,
        asA: (field === 'asA' ? text : item.asA) ?? undefined,
        iWant: (field === 'iWant' ? text : item.iWant) ?? undefined,
        soThat: (field === 'soThat' ? text : item.soThat) ?? undefined,
        description: (field === 'description' ? text : item.description) ?? undefined,
        acceptanceCriteria: field === 'acceptanceCriteria' ? list : item.acceptanceCriteria,
        priority: item.priority,
        expectedVersion: version(item.version, field === 'acceptanceCriteria' ? item.acceptanceCriteria : (item[field as 'title' | 'asA' | 'iWant' | 'soThat' | 'description'] ?? '')),
      });
      await updateItemInTx(tx, clock, userId, projectId, id, input);
      return done(STORY_GATE(id));
    }
    case 'PROJECT': {
      const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
      const input = ProjectUpdateSchema.parse({
        name: project.name,
        description: project.description,
        productGoal: field === 'productGoal' ? text : project.productGoal,
        definitionOfDone: field === 'definitionOfDone' ? text : project.definitionOfDone,
        expectedVersion: version(project.version, field === 'productGoal' ? project.productGoal : project.definitionOfDone),
      });
      await updateProject(db, clock, userId, projectId, input);
      return done(null);
    }
    case 'SPRINT': {
      const sprint = await tx.sprint.findFirst({ where: { id, projectId } });
      if (!sprint) throw AppError.notFound('No se encontró el Sprint.');
      const input = SprintUpdateSchema.parse({ [field]: text, expectedVersion: version(sprint.version, field === 'sprintGoal' ? sprint.sprintGoal : sprint.workPlan) });
      await updateSprint(db, clock, userId, projectId, id, input);
      return done(gate('GATE-PLAN', 'SPRINT', id));
    }
    case 'SPRINT_TASK': {
      const task = await tx.sprintTask.findFirst({ where: { id, sprint: { projectId } } });
      if (!task) throw AppError.notFound('No se encontró la tarea.');
      await updateTask(db, clock, userId, projectId, task.sprintId, id, { title: text, expectedVersion: version(task.version, task.title) });
      return done(null);
    }
    case 'SPRINT_REVIEW': {
      const review = await tx.sprintReview.findUnique({ where: { sprintId: id } });
      const input = SprintReviewUpdateSchema.parse({
        results: field === 'results' ? text : (review?.results ?? ''),
        increment: field === 'increment' ? text : (review?.increment ?? ''),
        feedback: field === 'feedback' ? text : (review?.feedback ?? ''),
        goalAssessment: review?.goalAssessment ?? null,
        goalAssessmentNote: field === 'goalAssessmentNote' ? text : (review?.goalAssessmentNote ?? ''),
        expectedVersion: version(review?.version ?? 1, review ? review[field as 'results' | 'increment' | 'feedback' | 'goalAssessmentNote'] : ''),
      });
      await updateReview(db, clock, userId, projectId, id, input);
      return done(gate('GATE-REVIEW', 'SPRINT_REVIEW', id));
    }
    case 'RETROSPECTIVE': {
      const retro = await tx.retrospective.findUnique({ where: { sprintId: id } });
      const input = RetrospectiveUpdateSchema.parse({
        positives: field === 'positives' ? list : (retro?.positives ?? []),
        problems: field === 'problems' ? list : (retro?.problems ?? []),
        improvements: field === 'improvements' ? list : (retro?.improvements ?? []),
        expectedVersion: version(retro?.version ?? 1, retro ? retro[field as 'positives' | 'problems' | 'improvements'] : []),
      });
      await updateRetrospective(db, clock, userId, projectId, id, input);
      return done(gate('GATE-RETRO', 'RETROSPECTIVE', id));
    }
    case 'RETRO_ACTION': {
      const action = await tx.retroAction.findFirst({ where: { id, retrospective: { sprint: { projectId } } }, include: { retrospective: { include: { sprint: true } } } });
      if (!action) throw AppError.notFound('No se encontró la acción.');
      await updateAction(db, clock, userId, projectId, action.sprintId, id, { description: text, expectedVersion: version(action.version, action.description) });
      return done(action.retrospective.sprint.status === 'OPEN' ? gate('GATE-RETRO', 'RETROSPECTIVE', action.sprintId) : null);
    }
    default:
      throw AppError.validation('Este artefacto no tiene campos que se puedan modificar.');
  }
}

/** Guarda una propuesta de cambio de un campo (nunca se aplica sola). */
export async function storeFieldChange(
  db: Db,
  clock: Clock,
  params: { projectId: string; userId: string; interactionId: string; targetVersion: number | null; change: FieldChange; sources: SourceRef[] },
) {
  const payload: SuggestionPayload = {
    title: params.change.fieldLabel,
    text: params.change.rationale,
    acceptanceCriteria: [],
    itemId: null,
    itemCode: null,
    change: params.change,
  };
  const row = await db.aiSuggestion.create({
    data: {
      projectId: params.projectId,
      interactionId: params.interactionId,
      askedBy: params.userId,
      kind: 'FIELD_CHANGE',
      payload: payload as unknown as object,
      sources: params.sources as unknown as object,
      targetVersion: params.targetVersion,
      createdAt: clock.now(),
    },
  });
  return toSuggestionDto(row);
}

export type { ArtifactField };

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
      return { applied: { entity: null, id: null, gate: null } as Applied };
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
    let applied: Applied = { entity: null, id: null, gate: null };
    if (row.kind === 'STORY') applied = await applyStory(tx, clock, userId, projectId, payload);
    else if (row.kind === 'ACCEPTANCE_CRITERIA') applied = await applyCriteria(tx, clock, userId, projectId, payload);
    else if (row.kind === 'TASK') applied = await applyTask(tx, clock, userId, projectId, payload);
    else if (row.kind === 'FIELD_CHANGE') applied = await applyFieldChange(tx, clock, userId, projectId, row, payload, edit.value);

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
  if (outcome.applied.gate) {
    const run = await evaluateGate(db, clock, userId, projectId, { ...outcome.applied.gate, requestAiFeedback: false });
    revalidation = { runId: run.id, gateId: run.gateId, status: run.status, attemptNo: run.attemptNo };
  }
  return {
    suggestion: toSuggestionDto(row),
    result: { entity: outcome.applied.entity, id: outcome.applied.id },
    revalidation,
    notice: 'Cambio aplicado por una persona a partir de una sugerencia de IA. La IA no aprueba compuertas: solo las reglas lo hacen.',
  };
}
