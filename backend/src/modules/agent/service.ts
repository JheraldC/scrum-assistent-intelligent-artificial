import type { ChatRequest, TargetType } from '@scrum/shared';
import { AppError } from '../../platform/errors.js';
import type { Config } from '../../platform/config.js';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';
import { GATES, getGate } from '../validation/index.js';
import type { AgentBudget } from './budget.js';
import { buildContext, MAX_HISTORY, type ContextInput } from './context.js';
import { LlmProviderError, LlmRateLimitError, LlmTimeoutError, type LlmProvider } from './llm/index.js';
import { parseAgentOutput, type ChatReply, type OutputKind, type ValidationFeedback } from './output.js';
import { PROMPT_VERSION, PROMPTS } from './prompts/index.js';

type Status = 'OK' | 'TIMEOUT' | 'PROVIDER_ERROR' | 'INVALID_RESPONSE' | 'BUDGET_EXCEEDED' | 'RATE_LIMITED';

export const DISCLAIMER =
  'Esta es una recomendación generada por IA y puede contener errores. Verifíquela con su equipo antes de aplicarla; no cambia el resultado de las evaluaciones.';

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
    const context = await this.chatContext(userId, projectId, request);
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
    return {
      interactionId: outcome.interactionId,
      answer: reply.answer,
      suggestions: reply.suggestions ?? [],
      referencedCriteria: reply.referencedCriteria ?? [],
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
  private async chatContext(userId: string, projectId: string, request: ChatRequest): Promise<ContextInput> {
    const { db } = this.deps;
    const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    const history = await db.agentInteraction.findMany({
      where: { projectId, userId, kind: 'CHAT', status: 'OK' },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY,
    });
    const base: ContextInput = {
      productGoal: project.productGoal,
      stages: await this.stages(projectId),
      catalog: GATES.flatMap((g) => g.criteria).map((c) => ({ id: c.id, title: c.title, origin: c.origin })),
      history: history.reverse().map((h) => ({ question: h.question, answer: this.answerOf(h.response) ?? '' })),
      message: request.message,
    };
    if (!request.focus) return base;

    const focus = await this.focusOf(projectId, request.focus.targetType, request.focus.targetId);
    if (!focus) return base;
    const gate = GATES.find((g) => g.targetType === request.focus!.targetType);
    return { ...base, focus, catalog: gate ? gate.criteria.map((c) => ({ id: c.id, title: c.title, origin: c.origin })) : base.catalog };
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
