import type { ArtifactType, GateId, TargetType } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import type { Db } from '../../platform/db.js';

/**
 * Registro de artefactos editables sobre los que el asistente recomienda campo por campo. Solo lista
 * campos que la persona ya puede editar en la aplicación; los demás (estados, compuertas, excepciones,
 * responsables) quedan fuera a propósito.
 */
export type FieldValue = string | string[];

export interface ArtifactField {
  key: string;
  label: string;
  kind: 'text' | 'list';
  value: FieldValue;
}

export interface LoadedArtifact {
  type: ArtifactType;
  id: string;
  label: string;
  /** Versión para el control optimista; null si el artefacto no tiene campos editables. */
  version: number | null;
  fields: ArtifactField[];
  /** Compuerta determinista que se reevalúa tras aplicar un cambio (si el artefacto tiene reglas). */
  gate: { gateId: GateId; targetType: TargetType; targetId: string } | null;
  /** Texto adicional de solo lectura (artefactos sin campos editables: análisis asesor de IA). */
  readOnlyNote?: string;
}

const text = (key: string, label: string, value: string | null | undefined): ArtifactField => ({ key, label, kind: 'text', value: value ?? '' });
const list = (key: string, label: string, value: string[]): ArtifactField => ({ key, label, kind: 'list', value });

export async function loadArtifact(db: Db, projectId: string, type: ArtifactType, id: string): Promise<LoadedArtifact> {
  const notFound = () => AppError.notFound('No se encontró el artefacto.');
  switch (type) {
    case 'BACKLOG_ITEM': {
      const item = await db.backlogItem.findFirst({ where: { id, projectId } });
      if (!item) throw notFound();
      return {
        type,
        id,
        label: `${item.code} · ${item.title}`,
        version: item.version,
        fields: [
          text('title', 'Título', item.title),
          ...(item.kind === 'USER_STORY'
            ? [text('asA', 'Como (rol)', item.asA), text('iWant', 'Quiero (necesidad)', item.iWant), text('soThat', 'Para (beneficio)', item.soThat)]
            : [text('description', 'Descripción', item.description)]),
          list('acceptanceCriteria', 'Criterios de aceptación', item.acceptanceCriteria),
        ],
        gate: { gateId: 'GATE-STORY', targetType: 'BACKLOG_ITEM', targetId: id },
      };
    }
    case 'PROJECT': {
      if (id !== projectId) throw notFound();
      const p = await db.project.findUniqueOrThrow({ where: { id } });
      return {
        type,
        id,
        label: 'Product Goal y Definition of Done',
        version: p.version,
        fields: [text('productGoal', 'Product Goal', p.productGoal), text('definitionOfDone', 'Definition of Done', p.definitionOfDone)],
        gate: null,
      };
    }
    case 'SPRINT': {
      const sprint = await db.sprint.findFirst({ where: { id, projectId } });
      if (!sprint) throw notFound();
      return {
        type,
        id,
        label: `Planificación del Sprint ${sprint.number}`,
        version: sprint.version,
        fields: [text('sprintGoal', 'Sprint Goal', sprint.sprintGoal), text('workPlan', 'Plan de trabajo', sprint.workPlan)],
        gate: { gateId: 'GATE-PLAN', targetType: 'SPRINT', targetId: id },
      };
    }
    case 'SPRINT_TASK': {
      const task = await db.sprintTask.findFirst({ where: { id, sprint: { projectId } }, include: { sprint: true } });
      if (!task) throw notFound();
      return { type, id, label: `Tarea: ${task.title}`, version: task.version, fields: [text('title', 'Título de la tarea', task.title)], gate: null };
    }
    case 'SPRINT_REVIEW': {
      const sprint = await db.sprint.findFirst({ where: { id, projectId } });
      if (!sprint) throw notFound();
      const r = await db.sprintReview.findUnique({ where: { sprintId: id } });
      return {
        type,
        id,
        label: `Review del Sprint ${sprint.number}`,
        version: r?.version ?? 1,
        fields: [
          text('results', 'Resultados del Sprint', r?.results),
          text('increment', 'Incremento presentado', r?.increment),
          text('feedback', 'Retroalimentación recibida', r?.feedback),
          text('goalAssessmentNote', 'Explicación de la valoración del Sprint Goal', r?.goalAssessmentNote),
        ],
        gate: { gateId: 'GATE-REVIEW', targetType: 'SPRINT_REVIEW', targetId: id },
      };
    }
    case 'RETROSPECTIVE': {
      const sprint = await db.sprint.findFirst({ where: { id, projectId } });
      if (!sprint) throw notFound();
      const r = await db.retrospective.findUnique({ where: { sprintId: id } });
      return {
        type,
        id,
        label: `Retrospectiva del Sprint ${sprint.number}`,
        version: r?.version ?? 1,
        fields: [list('positives', 'Aspectos positivos', r?.positives ?? []), list('problems', 'Problemas', r?.problems ?? []), list('improvements', 'Oportunidades de mejora', r?.improvements ?? [])],
        gate: { gateId: 'GATE-RETRO', targetType: 'RETROSPECTIVE', targetId: id },
      };
    }
    case 'RETRO_ACTION': {
      const action = await db.retroAction.findFirst({ where: { id, retrospective: { sprint: { projectId } } }, include: { retrospective: { include: { sprint: true } } } });
      if (!action) throw notFound();
      return {
        type,
        id,
        label: `Acción de retrospectiva: ${action.description.slice(0, 60)}`,
        version: action.version,
        fields: [text('description', 'Descripción de la acción', action.description)],
        // Las acciones se evalúan con la retrospectiva de su Sprint, mientras ese Sprint siga abierto.
        gate: action.retrospective.sprint.status === 'OPEN' ? { gateId: 'GATE-RETRO', targetType: 'RETROSPECTIVE', targetId: action.sprintId } : null,
      };
    }
    case 'TRACKING': {
      const sprint = await db.sprint.findFirst({ where: { id, projectId } });
      if (!sprint) throw notFound();
      const entries = await db.trackingEntry.findMany({ where: { sprintId: id }, orderBy: { createdAt: 'asc' }, take: 30 });
      return {
        type,
        id,
        label: `Seguimiento del Sprint ${sprint.number}`,
        version: null,
        // Los registros de seguimiento son un historial: no se editan, así que el análisis es solo asesor.
        fields: [],
        gate: null,
        readOnlyNote: entries.length === 0 ? 'Aún no hay registros de seguimiento.' : entries.map((e) => `[${e.kind}${e.resolvedAt ? ', resuelto' : ''}] ${e.content}`).join('\n'),
      };
    }
  }
}
