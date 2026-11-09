import type { BacklogItemInput, BacklogItemUpdate, GateState } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import { withTransaction, type Db, type Tx } from '../../platform/db.js';
import type { Clock } from '../../platform/clock.js';
import { latestRuns } from '../../platform/runs.js';
import { ActivityRecorder } from '../activity/index.js';
import { deriveGateState, type StorySnapshot } from '../validation/index.js';

interface ItemRow {
  id: string;
  code: string;
  kind: 'USER_STORY' | 'ITEM';
  title: string;
  asA: string | null;
  iWant: string | null;
  soThat: string | null;
  description: string | null;
  acceptanceCriteria: string[];
  priority: number;
  version: number;
  updatedAt: Date;
}

export function toBacklogItemDto(item: ItemRow, gateState: GateState) {
  return {
    id: item.id,
    code: item.code,
    kind: item.kind,
    title: item.title,
    asA: item.asA,
    iWant: item.iWant,
    soThat: item.soThat,
    description: item.description,
    acceptanceCriteria: item.acceptanceCriteria,
    priority: item.priority,
    version: item.version,
    gateState,
    updatedAt: item.updatedAt.toISOString(),
  };
}

type BacklogItemDto = ReturnType<typeof toBacklogItemDto>;

async function gateStates(db: Tx, projectId: string, items: ItemRow[]): Promise<Map<string, GateState>> {
  const runs = await latestRuns(db, projectId, 'BACKLOG_ITEM', items.map((i) => i.id));
  return new Map(
    items.map((item) => {
      const run = runs.get(item.id);
      // GATE-STORY no es bloqueante y no admite excepciones, pero se respeta si existiera una.
      const latest = run ? { status: run.status, targetVersion: run.targetVersion, hasException: run.hasException } : null;
      return [item.id, deriveGateState(latest, item.version)] as const;
    }),
  );
}

/** Para historias se guardan cadenas (posiblemente vacías) en rol, necesidad y beneficio; para elementos, nulos. */
function storyFields(input: BacklogItemInput) {
  const isStory = input.kind === 'USER_STORY';
  return {
    kind: input.kind,
    title: input.title,
    asA: isStory ? (input.asA ?? '') : null,
    iWant: isStory ? (input.iWant ?? '') : null,
    soThat: isStory ? (input.soThat ?? '') : null,
    description: isStory ? null : (input.description ?? ''),
    acceptanceCriteria: input.acceptanceCriteria,
    priority: input.priority,
  };
}

export async function listItems(db: Db, projectId: string): Promise<BacklogItemDto[]> {
  const items = await db.backlogItem.findMany({ where: { projectId }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] });
  const states = await gateStates(db, projectId, items);
  return items.map((item) => toBacklogItemDto(item, states.get(item.id) ?? 'NO_EVALUADA'));
}

export async function getItem(db: Db, projectId: string, itemId: string): Promise<BacklogItemDto> {
  const item = await db.backlogItem.findFirst({ where: { id: itemId, projectId } });
  if (!item) throw AppError.notFound('No se encontró el elemento del Product Backlog.');
  const states = await gateStates(db, projectId, [item]);
  return toBacklogItemDto(item, states.get(item.id) ?? 'NO_EVALUADA');
}

/** Código por proyecto: HU-n para historias y EL-n para elementos (único por proyecto). */
async function nextCode(tx: Tx, projectId: string, kind: 'USER_STORY' | 'ITEM'): Promise<string> {
  const prefix = kind === 'USER_STORY' ? 'HU' : 'EL';
  const rows = await tx.backlogItem.findMany({ where: { projectId, kind }, select: { code: true } });
  const max = rows.reduce((acc, r) => Math.max(acc, Number(r.code.slice(prefix.length + 1)) || 0), 0);
  return `${prefix}-${max + 1}`;
}

export async function createItem(db: Db, clock: Clock, actorId: string, projectId: string, input: BacklogItemInput) {
  return withTransaction(db, async (tx) => {
    // Serializa la generación de códigos del mismo proyecto.
    await tx.$queryRaw`SELECT id FROM "project" WHERE id = ${projectId}::uuid FOR UPDATE`;
    const now = clock.now();
    const item = await tx.backlogItem.create({
      data: {
        ...storyFields(input),
        projectId,
        code: await nextCode(tx, projectId, input.kind),
        createdBy: actorId,
        createdAt: now,
        updatedAt: now,
      },
    });
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'backlog_item.created',
      entityType: 'backlog_item',
      entityId: item.id,
      payload: { code: item.code },
      occurredAt: now,
    });
    return toBacklogItemDto(item, 'NO_EVALUADA');
  });
}

/** Edición con control de versión (FR-036): 409 con el estado actual si la versión no coincide. */
export async function updateItem(
  db: Db,
  clock: Clock,
  actorId: string,
  projectId: string,
  itemId: string,
  input: BacklogItemUpdate,
) {
  const { expectedVersion, ...fields } = input;
  return withTransaction(db, async (tx) => {
    const existing = await tx.backlogItem.findFirst({ where: { id: itemId, projectId } });
    if (!existing) throw AppError.notFound('No se encontró el elemento del Product Backlog.');
    // El tipo no cambia: el código (HU-n / EL-n) depende de él.
    if (existing.kind !== fields.kind) throw AppError.validation('No se puede cambiar el tipo de un elemento ya creado.');
    const now = clock.now();
    const result = await tx.backlogItem.updateMany({
      where: { id: itemId, projectId, version: expectedVersion },
      data: { ...storyFields(fields), version: { increment: 1 }, updatedAt: now },
    });
    const current = await tx.backlogItem.findFirst({ where: { id: itemId, projectId } });
    if (!current) throw AppError.notFound('No se encontró el elemento del Product Backlog.');
    const states = await gateStates(tx, projectId, [current]);
    const dto = toBacklogItemDto(current, states.get(current.id) ?? 'NO_EVALUADA');
    if (result.count === 0) {
      throw new AppError(
        'VERSION_CONFLICT',
        409,
        'Otra persona modificó este elemento mientras lo editaba. Recargue para ver los cambios.',
        undefined,
        { current: dto },
      );
    }
    await ActivityRecorder.record(tx, {
      projectId,
      actorId,
      action: 'backlog_item.updated',
      entityType: 'backlog_item',
      entityId: itemId,
      payload: { code: current.code },
      occurredAt: now,
    });
    return dto;
  });
}

/** Instantánea del elemento para el motor de reglas; bloquea la fila (`FOR UPDATE`) dentro de la transacción. */
export async function getItemSnapshot(
  tx: Tx,
  projectId: string,
  itemId: string,
): Promise<{ version: number; snapshot: StorySnapshot } | null> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "backlog_item" WHERE id = ${itemId}::uuid AND project_id = ${projectId}::uuid FOR UPDATE`;
  if (locked.length === 0) return null;
  const item = await tx.backlogItem.findUniqueOrThrow({ where: { id: itemId } });
  return {
    version: item.version,
    snapshot: {
      kind: item.kind,
      title: item.title,
      asA: item.asA,
      iWant: item.iWant,
      soThat: item.soThat,
      description: item.description,
      acceptanceCriteria: item.acceptanceCriteria,
      priority: item.priority,
    },
  };
}
