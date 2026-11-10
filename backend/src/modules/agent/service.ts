import type { ChatRequest, TargetType } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import type { Config } from '../../platform/config.js';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { latestRuns } from '../../platform/runs.js';
import { contextDocuments, selectRelevant, type ContextDocument } from '../documents/index.js';
import { attentionItems, listDecisions } from '../team/index.js';
import { deriveGateState, GATES, getGate } from '../validation/index.js';
import { storeProposals } from './suggestions.js';
import type { AgentBudget } from './budget.js';
import { buildContext, MAX_HISTORY, type ContextInput } from './context.js';
import { LlmProviderError, LlmRateLimitError, LlmTimeoutError, type LlmProvider } from './llm/index.js';
import { parseAgentOutput, type ChatReply, type OutputKind, type ValidationFeedback } from './output.js';
import { PROMPT_VERSION, PROMPTS } from './prompts/index.js';

type Status = 'OK' | 'TIMEOUT' | 'PROVIDER_ERROR' | 'INVALID_RESPONSE' | 'BUDGET_EXCEEDED' | 'RATE_LIMITED';

export const DISCLAIMER =
  'Esta es una recomendación generada por IA y puede contener errores. Verifíquela con su equipo antes de aplicarla; no cambia el resultado de las evaluaciones.';

export const PROVIDER_NOTICE =
  'Para responder, el contenido pertinente de este proyecto (datos del Sprint, Product Backlog, decisiones y fragmentos de los documentos marcados para la IA) se envía al proveedor externo de IA configurado. No se envía información de otros proyectos ni credenciales.';

const RULES_STILL_WORK = 'Las comprobaciones por reglas siguen funcionando.';

export interface AgentDeps {
  db: Db;
  llm: LlmProvider;
  budget: AgentBudget;
  clock: Clock;
  config: Config;
  /** Espera entre reintentos (inyectable para pruebas). */
  sleep?: (ms: number) => Promise<void>;
}

interface CallOutcome<T> {
  ok: boolean;
  value?: T;
  status: Status;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  detail?: string;
}

const failureError: Record<Exclude<Status, 'OK' | 'RATE_LIMITED'>, () => AppError> = {
  TIMEOUT: () => new AppError('AI_TIMEOUT', 502, `El asistente tardó demasiado en responder. ${RULES_STILL_WORK}`),
  PROVIDER_ERROR: () => new AppError('AI_UNAVAILABLE', 502, `El asistente no está disponible en este momento. ${RULES_STILL_WORK}`),
  INVALID_RESPONSE: () => new AppError('AI_INVALID_RESPONSE', 502, `El asistente devolvió una respuesta que no se pudo usar. ${RULES_STILL_WORK}`),
  BUDGET_EXCEEDED: () => new AppError('AI_BUDGET_EXCEEDED', 429, `El servicio de IA alcanzó su límite de uso. Intente más tarde. ${RULES_STILL_WORK}`),
};

/**
 * Servicio del agente (plan.md, "Agente inteligente"). Solo lee datos del proyecto y escribe el
 * registro de sus propias interacciones: no tiene ninguna vía para modificar artefactos ni para
 * cambiar el estado de una compuerta (FR-021, FR-023).
 */
export class AgentService {
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly deps: AgentDeps) {
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  // ------------------------------------------------------------------------------------------
  // Chat contextual (FR-020)
  // ------------------------------------------------------------------------------------------

  async chat(userId: string, projectId: string, request: ChatRequest) {
    const { input: context, documents, openSprintItemIds, usedData } = await this.chatContext(userId, projectId, request);
    const built = buildContext(context);
    const outcome = await this.invoke<ChatReply>({
      kind: 'CHAT',
      outputKind: 'chat_reply',
      userId,
      projectId,
      question: request.message,
      task: PROMPTS.chat,
      context: built.text,
    });
    const reply = outcome.value!;

    // Solo se aceptan citas de fragmentos que realmente se enviaron al modelo.
    const sent = new Map<string, Set<string>>();
    for (const f of built.includedFragments) {
      if (!sent.has(f.document)) sent.set(f.document, new Set());
      sent.get(f.document)!.add(f.section);
    }
    const knownSources = [...sent].map(([document, sections]) => ({ document, sections: [...sections] }));
    const sources = (reply.sources ?? [])
      .filter((s) => sent.has(s.document))
      .map((s) => ({ document: s.document, section: s.section && sent.get(s.document)!.has(s.section) ? s.section : null }));

    const proposals = await storeProposals(this.deps.db, this.deps.clock, {
      projectId,
      userId,
      interactionId: outcome.interactionId,
      proposals: reply.proposals ?? [],
      knownSources,
      openSprintItemIds,
    });
    return {
      interactionId: outcome.interactionId,
      answer: reply.answer,
      suggestions: reply.suggestions ?? [],
      referencedCriteria: reply.referencedCriteria ?? [],
      proposals,
      // «Documento» solo con una cita verificada; todo lo demás es inferencia de la IA.
      basis: sources.length > 0 ? ('DOCUMENTO' as const) : ('INFERENCIA' as const),
      sources,
      contextUsed: {
        projectData: usedData,
        documents: knownSources,
        documentsAvailable: documents.length,
        focus: request.focus ? (context.focus?.label ?? null) : null,
      },
      providerNotice: PROVIDER_NOTICE,
      disclaimer: DISCLAIMER,
      source: 'AI_RECOMMENDATION' as const,
      model: outcome.model,
    };
  }

  // ------------------------------------------------------------------------------------------
  // Retroalimentación sobre una evaluación existente (bajo demanda; no cambia su estado)
  // ------------------------------------------------------------------------------------------

  async feedbackForRun(userId: string, projectId: string, runId: string) {
    const run = await this.deps.db.validationRun.findFirst({ where: { id: runId, projectId }, include: { results: true } });
    if (!run) throw AppError.notFound('No se encontró la evaluación.');
    const gate = getGate(run.gateId as never);
    const titles = new Map(gate?.criteria.map((c) => [c.id, c.title]));
    const project = await this.deps.db.project.findUniqueOrThrow({ where: { id: projectId } });

    const context: ContextInput = {
      productGoal: project.productGoal,
      stages: await this.stages(projectId),
      focus: {
        label: `${run.gateId} · intento ${run.attemptNo}`,
        snapshot: (run.targetSnapshot ?? {}) as Record<string, unknown>,
        failedCriteria: run.results
          .filter((r) => r.outcome === 'NOT_MET')
          .map((r) => ({ id: r.criterionId, title: titles.get(r.criterionId) ?? r.criterionId, origin: r.origin, explanation: r.explanation })),
      },
      catalog: gate?.criteria.map((c) => ({ id: c.id, title: c.title, origin: c.origin })) ?? [],
      history: [],
      message: 'Escribe observaciones asesoras sobre este artefacto y sus criterios no cumplidos.',
    };
    const outcome = await this.invoke<ValidationFeedback>({
      kind: 'VALIDATION_FEEDBACK',
      outputKind: 'validation_feedback',
      userId,
      projectId,
      validationRunId: run.id,
      question: '',
      task: PROMPTS.validationFeedback,
      context: buildContext(context).text,
    });
    return {
      interactionId: outcome.interactionId,
      observations: (outcome.value!.observations ?? []).map((o) => ({
        criterionId: o.criterionId ?? null,
        text: o.text,
        suggestedRewrite: o.suggestedRewrite ?? null,
        source: 'AI_RECOMMENDATION' as const,
      })),
    };
  }

  // ------------------------------------------------------------------------------------------
  // Historial (FR-025)
  // ------------------------------------------------------------------------------------------

  async listInteractions(projectId: string) {
    const rows = await this.deps.db.agentInteraction.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { pseudonym: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      model: r.model,
      provider: r.provider,
      promptVersion: r.promptVersion,
      status: r.status,
      question: r.question,
      answer: this.answerOf(r.response),
      userPseudonym: r.user.pseudonym,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ------------------------------------------------------------------------------------------
  // Internos
  // ------------------------------------------------------------------------------------------

  private answerOf(response: unknown): string | null {
    const value = response as { answer?: unknown; summary?: unknown } | null;
    if (typeof value?.answer === 'string') return value.answer;
    return typeof value?.summary === 'string' ? value.summary : null;
  }

  private async stages(projectId: string) {
    const sprint = await this.deps.db.sprint.findFirst({ where: { projectId, status: 'OPEN' }, include: { stages: true } });
    return (sprint?.stages ?? []).map((s) => ({ type: s.type, status: s.status }));
  }

  /** Contexto del chat: solo datos del proyecto actual (nunca correos, seudónimos ajenos ni otros proyectos). */
  private async chatContext(
    userId: string,
    projectId: string,
    request: ChatRequest,
  ): Promise<{ input: ContextInput; documents: ContextDocument[]; openSprintItemIds: Set<string>; usedData: string[] }> {
    const { db } = this.deps;
    const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    const history = await db.agentInteraction.findMany({
      where: { projectId, userId, kind: 'CHAT', status: 'OK' },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY,
    });
    // Contexto progresivo: solo lo que existe y pertenece a ESTE proyecto.
    const sprint = await db.sprint.findFirst({
      where: { projectId, status: 'OPEN' },
      include: { items: { include: { backlogItem: true } }, tasks: true },
    });
    const backlogRows = await db.backlogItem.findMany({ where: { projectId }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }], take: 30 });
    const runs = await latestRuns(db, projectId, 'BACKLOG_ITEM', backlogRows.map((b) => b.id));
    const decisions = (await listDecisions(db, projectId)).slice(0, 5);
    const attention = (await attentionItems(db, projectId, this.deps.clock.now())).map((a) => `${a.message}${a.count ? ` (${a.count})` : ''}`);
    const documents = await contextDocuments(db, projectId);
    const fragments = selectRelevant(documents, request.message, 3600);

    const base: ContextInput = {
      productGoal: project.productGoal,
      definitionOfDone: project.definitionOfDone,
      stages: await this.stages(projectId),
      sprint: sprint
        ? {
            goal: sprint.sprintGoal,
            plan: sprint.workPlan,
            items: sprint.items
              .map((i) => i.backlogItem)
              .sort((a, b) => a.priority - b.priority)
              .map((b) => {
                const tasks = sprint.tasks.filter((t) => t.backlogItemId === b.id);
                return { code: b.code, title: b.title, totalTasks: tasks.length, doneTasks: tasks.filter((t) => t.status === 'DONE').length };
              }),
          }
        : null,
      backlog: backlogRows.map((b) => {
        const run = runs.get(b.id);
        const state = deriveGateState(run ? { status: run.status, targetVersion: run.targetVersion, hasException: run.hasException } : null, b.version);
        return { code: b.code, title: b.title, state, criteria: b.acceptanceCriteria.length };
      }),
      decisions: decisions.map((d) => ({ kind: d.kind, text: d.text })),
      attention,
      documents: {
        available: documents.map((d) => ({ name: d.name, sections: d.sections.map((x) => x.title) })),
        fragments: fragments.map((f) => ({ document: f.document, section: f.title, text: f.text })),
      },
      catalog: GATES.flatMap((g) => g.criteria).map((c) => ({ id: c.id, title: c.title, origin: c.origin })),
      history: history.reverse().map((h) => ({ question: h.question, answer: this.answerOf(h.response) ?? '' })),
      message: request.message,
    };
    const usedData = [
      'Objetivo del producto',
      ...(project.definitionOfDone.trim() !== '' ? ['Definition of Done'] : []),
      ...(sprint ? ['Sprint activo y su Sprint Goal'] : []),
      ...(backlogRows.length > 0 ? [`Product Backlog (${backlogRows.length} elemento(s))`] : []),
      ...(decisions.length > 0 ? [`Decisiones y acuerdos (${decisions.length})`] : []),
      ...(attention.length > 0 ? ['Asuntos detectados por reglas'] : []),
    ];
    const openSprintItemIds = new Set(sprint?.items.map((i) => i.backlogItemId) ?? []);
    const wrap = (input: ContextInput) => ({ input, documents, openSprintItemIds, usedData });
    if (!request.focus) return wrap(base);

    const focus = await this.focusOf(projectId, request.focus.targetType, request.focus.targetId);
    if (!focus) return wrap(base);
    const gate = GATES.find((g) => g.targetType === request.focus!.targetType);
    return wrap({ ...base, focus, catalog: gate ? gate.criteria.map((c) => ({ id: c.id, title: c.title, origin: c.origin })) : base.catalog });
  }

  private async focusOf(projectId: string, targetType: TargetType, targetId: string): Promise<ContextInput['focus'] | null> {
    const { db } = this.deps;
    let label: string;
    let snapshot: Record<string, unknown>;
    if (targetType === 'BACKLOG_ITEM') {
      const item = await db.backlogItem.findFirst({ where: { id: targetId, projectId } });
      if (!item) return null;
      label = `${item.code} · ${item.title}`;
      snapshot = { tipo: item.kind, titulo: item.title, rol: item.asA, necesidad: item.iWant, beneficio: item.soThat, descripcion: item.description, criteriosDeAceptacion: item.acceptanceCriteria, prioridad: item.priority };
    } else if (targetType === 'SPRINT') {
      const sprint = await db.sprint.findFirst({ where: { id: targetId, projectId }, include: { items: { include: { backlogItem: true } } } });
      if (!sprint) return null;
      label = `Sprint ${sprint.number}`;
      snapshot = { sprintGoal: sprint.sprintGoal, planDeTrabajo: sprint.workPlan, elementos: sprint.items.map((i) => `${i.backlogItem.code} ${i.backlogItem.title}`) };
    } else if (targetType === 'RETROSPECTIVE') {
      const retro = await db.retrospective.findFirst({ where: { sprintId: targetId, sprint: { projectId } }, include: { sprint: true, actions: true } });
      if (!retro) return null;
      label = `Retrospectiva del Sprint ${retro.sprint.number}`;
      snapshot = { positivos: retro.positives, problemas: retro.problems, mejoras: retro.improvements, acciones: retro.actions.map((a) => `${a.description} (${a.ownerId ? 'con responsable' : 'sin responsable'})`) };
    } else if (targetType === 'SPRINT_REVIEW') {
      const review = await db.sprintReview.findFirst({ where: { sprintId: targetId, sprint: { projectId } }, include: { sprint: true } });
      if (!review) return null;
      label = `Review del Sprint ${review.sprint.number}`;
      snapshot = { sprintGoal: review.sprint.sprintGoal, resultados: review.results, incremento: review.increment, retroalimentacion: review.feedback, valoracionDelObjetivo: review.goalAssessment, explicacion: review.goalAssessmentNote };
    } else {
      return null;
    }
    const run = await db.validationRun.findFirst({
      where: { projectId, targetType, targetId },
      orderBy: { attemptNo: 'desc' },
      include: { results: true },
    });
    const gate = run ? getGate(run.gateId as never) : undefined;
    const titles = new Map(gate?.criteria.map((c) => [c.id, c.title]));
    return {
      label,
      snapshot,
      failedCriteria: (run?.results ?? [])
        .filter((r) => r.outcome === 'NOT_MET')
        .map((r) => ({ id: r.criterionId, title: titles.get(r.criterionId) ?? r.criterionId, origin: r.origin, explanation: r.explanation })),
    };
  }

  private modelConfig() {
    const { config } = this.deps;
    return { temperature: config.LLM_TEMPERATURE, maxOutputTokens: config.LLM_MAX_OUTPUT_TOKENS, timeoutMs: config.LLM_TIMEOUT_MS };
  }

  private async record(params: {
    kind: 'CHAT' | 'VALIDATION_FEEDBACK';
    userId: string;
    projectId: string;
    validationRunId?: string;
    question: string;
    response: unknown;
    status: Status;
    model: string;
    latencyMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
  }): Promise<string> {
    const { llm, clock, db } = this.deps;
    const row = await db.agentInteraction.create({
      data: {
        projectId: params.projectId,
        userId: params.userId,
        kind: params.kind,
        validationRunId: params.validationRunId ?? null,
        promptVersion: PROMPT_VERSION,
        provider: llm.name,
        model: params.model,
        modelConfig: this.modelConfig(),
        question: params.question.slice(0, 2000),
        response: (params.response ?? undefined) as object | undefined,
        status: params.status,
        latencyMs: params.latencyMs,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        createdAt: clock.now(),
      },
    });
    return row.id;
  }

  /** Comprueba el presupuesto, llama al modelo (con reintentos acotados), valida y registra siempre. */
  private async invoke<T extends ChatReply | ValidationFeedback>(params: {
    kind: 'CHAT' | 'VALIDATION_FEEDBACK';
    outputKind: OutputKind;
    userId: string;
    projectId: string;
    validationRunId?: string;
    question: string;
    task: string;
    context: string;
  }): Promise<{ value: T; interactionId: string; model: string }> {
    const base = { kind: params.kind, userId: params.userId, projectId: params.projectId, validationRunId: params.validationRunId, question: params.question, response: null };

    // 1) Límites de uso: se registra el intento rechazado y se informa con un mensaje claro.
    try {
      await this.deps.budget.check(params.userId, params.projectId);
    } catch (error) {
      if (error instanceof AppError) {
        await this.record({ ...base, status: error.code === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'BUDGET_EXCEEDED', model: this.deps.llm.model, latencyMs: null, inputTokens: null, outputTokens: null });
      }
      throw error;
    }

    // 2) Llamada al modelo.
    const outcome = await this.callModel<T>(params.outputKind, params.task, params.context);

    // 3) Registro (siempre) y resultado.
    const interactionId = await this.record({
      ...base,
      response: outcome.ok ? outcome.value : null,
      status: outcome.status,
      model: outcome.model,
      latencyMs: outcome.latencyMs,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
    });
    if (!outcome.ok) {
      const make = failureError[outcome.status as keyof typeof failureError];
      throw make();
    }
    return { value: outcome.value!, interactionId, model: outcome.model };
  }

  private async callModel<T>(outputKind: OutputKind, task: string, context: string): Promise<CallOutcome<T>> {
    const { llm, config } = this.deps;
    const system = PROMPTS.system;
    const original = `${task}\n\n${context}`;
    let userPrompt = original;
    const acc = { model: llm.model, inputTokens: 0, outputTokens: 0, latencyMs: 0 };
    let providerRetried = false;
    let rateRetried = false;
    let repairTried = false;
    const fail = (status: Status, detail?: string): CallOutcome<T> => ({ ok: false, status, detail, ...acc });

    for (;;) {
      let response;
      try {
        response = await llm.complete({ system, user: userPrompt, maxOutputTokens: config.LLM_MAX_OUTPUT_TOKENS, temperature: config.LLM_TEMPERATURE });
      } catch (error) {
        if (error instanceof LlmTimeoutError) return fail('TIMEOUT'); // sin reintento tras un timeout
        if (error instanceof LlmRateLimitError) {
          if (error.rateLimit) this.deps.budget.observeProvider(error.rateLimit);
          if (rateRetried) return fail('BUDGET_EXCEEDED');
          rateRetried = true;
          await this.sleep(Math.min(error.retryAfterMs ?? 500, 5000));
          continue;
        }
        if (error instanceof LlmProviderError && !providerRetried) {
          providerRetried = true;
          await this.sleep(300);
          continue;
        }
        return fail('PROVIDER_ERROR');
      }

      acc.model = response.model;
      acc.inputTokens += response.inputTokens ?? 0;
      acc.outputTokens += response.outputTokens ?? 0;
      acc.latencyMs += response.latencyMs;
      if (response.rateLimit) this.deps.budget.observeProvider(response.rateLimit);

      const parsed = parseAgentOutput(outputKind, response.text);
      if (parsed.ok) return { ok: true, value: parsed.value as T, status: 'OK', ...acc };
      if (repairTried) return fail('INVALID_RESPONSE', parsed.reason);
      repairTried = true; // un único reintento de reparación
      userPrompt = `${original}\n\nTu respuesta anterior no cumplió el formato JSON requerido (${parsed.reason}). Responde de nuevo SOLO con el JSON válido.`;
    }
  }
}
