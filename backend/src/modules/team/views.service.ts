import type { GateState } from '@scrum/shared';
import type { Db } from '../../platform/db.js';
import { latestRuns } from '../../platform/runs.js';
import { getOpenSprint, type SprintDto } from '../sprints/index.js';
import { deriveGateState } from '../validation/index.js';
import { toDecisionDto } from './decisions.service.js';
import { toTaskDto } from './tasks.service.js';

/**
 * Vistas por responsabilidad Scrum. Son de solo lectura y visibles para cualquier miembro del
 * proyecto (transparencia): la responsabilidad solo orienta cuál se muestra primero. Ninguna vista
 * puntúa, ordena ni cuenta el trabajo de personas concretas.
 */

export type AttentionSeverity = 'info' | 'warning';
export interface AttentionItem {
  code: string;
  severity: AttentionSeverity;
  message: string;
  count?: number;
}

const DAY_MS = 86_400_000;
const STALE_IMPEDIMENT_DAYS = 2;

interface ProjectHeader {
  id: string;
  name: string;
  description: string;
  productGoal: string;
  definitionOfDone: string;
}

async function header(db: Db, projectId: string): Promise<ProjectHeader> {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  return { id: p.id, name: p.name, description: p.description, productGoal: p.productGoal, definitionOfDone: p.definitionOfDone };
}

const stageSummary = (sprint: SprintDto) =>
  sprint.stages.map((s) => ({ type: s.type, status: s.status, gateState: s.gateState }));

async function backlogRows(db: Db, projectId: string) {
  const items = await db.backlogItem.findMany({ where: { projectId }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] });
  const runs = await latestRuns(db, projectId, 'BACKLOG_ITEM', items.map((i) => i.id));
  return items.map((item) => {
    const run = runs.get(item.id);
    const gateState: GateState = deriveGateState(run ? { status: run.status, targetVersion: run.targetVersion, hasException: run.hasException } : null, item.version);
    const reasons: string[] = [];
    if (item.acceptanceCriteria.filter((c) => c.trim() !== '').length === 0) reasons.push('Sin criterios de aceptación');
    if (gateState === 'NO_APROBADA') reasons.push('La última evaluación no se aprobó');
    if (gateState === 'DESACTUALIZADA') reasons.push('Cambió después de la última evaluación');
    if (gateState === 'NO_EVALUADA') reasons.push('Aún no se evaluó');
    return { item, gateState, reasons };
  });
}

async function openImpediments(db: Db, sprintId: string) {
  return db.trackingEntry.findMany({ where: { sprintId, kind: 'IMPEDIMENT', resolvedAt: null }, orderBy: { createdAt: 'asc' } });
}

async function pendingRetroActions(db: Db, projectId: string) {
  const rows = await db.retroAction.findMany({
    where: { status: 'OPEN', retrospective: { sprint: { projectId } } },
    orderBy: { createdAt: 'asc' },
    include: { owner: { select: { pseudonym: true } }, retrospective: { select: { sprint: { select: { number: true, status: true } } } } },
  });
  return rows.map((a) => ({
    id: a.id,
    description: a.description,
    sprintNumber: a.retrospective.sprint.number,
    forNextSprint: a.forNextSprint,
    ownerPseudonym: a.owner?.pseudonym ?? null,
    followUpNote: a.followUpNote,
  }));
}

/** Asuntos que requieren atención, calculados con reglas fijas (sin IA) y sin referirse a personas. */
export async function attentionItems(db: Db, projectId: string, now: Date): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];
  const project = await header(db, projectId);
  const sprint = await getOpenSprint(db, projectId);
  const rows = await backlogRows(db, projectId);

  if (project.definitionOfDone.trim() === '') {
    items.push({ code: 'NO_DOD', severity: 'info', message: 'El proyecto aún no tiene una Definition of Done compartida.' });
  }
  if (!sprint) {
    items.push({ code: 'NO_OPEN_SPRINT', severity: 'info', message: 'No hay un Sprint abierto.' });
  } else {
    if (sprint.sprintGoal.trim() === '') items.push({ code: 'NO_SPRINT_GOAL', severity: 'warning', message: 'El Sprint aún no tiene un Sprint Goal.' });
    const needs = sprint.stages.filter((s) => s.status === 'NEEDS_CORRECTION').length;
    if (needs > 0) items.push({ code: 'STAGE_NEEDS_CORRECTION', severity: 'warning', message: 'Hay etapas del Sprint que requieren corrección.', count: needs });
    const impediments = await openImpediments(db, sprint.id);
    if (impediments.length > 0) {
      items.push({ code: 'OPEN_IMPEDIMENTS', severity: 'warning', message: 'Hay impedimentos sin resolver.', count: impediments.length });
      const stale = impediments.filter((i) => now.getTime() - i.createdAt.getTime() > STALE_IMPEDIMENT_DAYS * DAY_MS).length;
      if (stale > 0) {
        items.push({ code: 'STALE_IMPEDIMENTS', severity: 'warning', message: `Hay impedimentos abiertos desde hace más de ${STALE_IMPEDIMENT_DAYS} días.`, count: stale });
      }
    }
  }
  const pending = (await pendingRetroActions(db, projectId)).length;
  if (pending > 0) items.push({ code: 'RETRO_ACTIONS_PENDING', severity: 'info', message: 'Hay acciones de retrospectiva sin cerrar.', count: pending });
  const unclear = rows.filter((r) => r.reasons.some((x) => x.startsWith('Sin criterios') || x.includes('no se aprobó'))).length;
  if (unclear > 0) items.push({ code: 'BACKLOG_NEEDS_CLARITY', severity: 'info', message: 'Hay elementos del Product Backlog que necesitan aclaración.', count: unclear });
  return items;
}

// ---------------------------------------------------------------------------------------------
// Scrum Master
// ---------------------------------------------------------------------------------------------

export async function scrumMasterView(db: Db, projectId: string, now: Date) {
  const sprint = await getOpenSprint(db, projectId);
  const impediments = sprint ? await openImpediments(db, sprint.id) : [];
  const decisions = await db.decision.findMany({
    where: { projectId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 5,
    include: { creator: { select: { pseudonym: true } } },
  });
  return {
    project: await header(db, projectId),
    sprint: sprint ? { id: sprint.id, number: sprint.number, sprintGoal: sprint.sprintGoal, stages: stageSummary(sprint) } : null,
    // Sin autor: el seguimiento de impedimentos es del equipo, no de las personas.
    impediments: impediments.map((i) => ({ id: i.id, content: i.content, createdAt: i.createdAt.toISOString() })),
    retroActions: await pendingRetroActions(db, projectId),
    attention: await attentionItems(db, projectId, now),
    decisions: decisions.map(toDecisionDto),
  };
}

// ---------------------------------------------------------------------------------------------
// Product Owner
// ---------------------------------------------------------------------------------------------

export async function productOwnerView(db: Db, projectId: string) {
  const rows = await backlogRows(db, projectId);
  const sprint = await getOpenSprint(db, projectId);
  const selected = new Set(sprint?.itemIds ?? []);
  const reviews = await db.sprintReview.findMany({
    where: { sprint: { projectId }, OR: [{ feedback: { not: '' } }, { results: { not: '' } }] },
    orderBy: { updatedAt: 'desc' },
    take: 3,
    include: { sprint: { select: { number: true } } },
  });
  return {
    project: await header(db, projectId),
    backlog: rows.map(({ item, gateState, reasons }) => ({
      id: item.id,
      code: item.code,
      kind: item.kind,
      title: item.title,
      priority: item.priority,
      asA: item.asA,
      iWant: item.iWant,
      soThat: item.soThat,
      acceptanceCriteria: item.acceptanceCriteria,
      gateState,
      needsClarification: reasons.length > 0,
      reasons,
      inSprint: selected.has(item.id),
    })),
    reviewFeedback: reviews.map((r) => ({
      sprintNumber: r.sprint.number,
      results: r.results,
      feedback: r.feedback,
      goalAssessment: r.goalAssessment,
      goalAssessmentNote: r.goalAssessmentNote,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Developers
// ---------------------------------------------------------------------------------------------

export async function developersView(db: Db, projectId: string) {
  const sprint = await getOpenSprint(db, projectId);
  if (!sprint) return { project: await header(db, projectId), sprint: null, items: [], unlinkedTasks: [], summary: { todo: 0, doing: 0, done: 0 }, impediments: [] };

  const sprintItems = await db.sprintItem.findMany({ where: { sprintId: sprint.id }, include: { backlogItem: true } });
  const tasks = await db.sprintTask.findMany({
    where: { sprintId: sprint.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { backlogItem: { select: { code: true, title: true } }, assignee: { select: { pseudonym: true } } },
  });
  const dtos = tasks.map(toTaskDto);
  const impediments = await openImpediments(db, sprint.id);
  return {
    project: await header(db, projectId),
    sprint: { id: sprint.id, number: sprint.number, sprintGoal: sprint.sprintGoal, workPlan: sprint.workPlan, stages: stageSummary(sprint) },
    items: sprintItems
      .map((i) => i.backlogItem)
      .sort((a, b) => a.priority - b.priority)
      .map((item) => ({
        id: item.id,
        code: item.code,
        title: item.title,
        acceptanceCriteria: item.acceptanceCriteria,
        tasks: dtos.filter((t) => t.backlogItemId === item.id),
      })),
    unlinkedTasks: dtos.filter((t) => t.backlogItemId === null),
    summary: {
      todo: dtos.filter((t) => t.status === 'TODO').length,
      doing: dtos.filter((t) => t.status === 'DOING').length,
      done: dtos.filter((t) => t.status === 'DONE').length,
    },
    impediments: impediments.map((i) => ({ id: i.id, content: i.content, createdAt: i.createdAt.toISOString() })),
  };
}
