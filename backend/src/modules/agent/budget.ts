import { AppError } from '../../platform/errors.js';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db.js';

/** Acceso a los contadores de uso (se sustituye por una versión en memoria en las pruebas). */
export interface BudgetStore {
  callsSince(userId: string, since: Date): Promise<number>;
  tokensSince(since: Date, projectId?: string): Promise<number>;
}

export interface BudgetLimits {
  userRatePerMinute: number;
  dailyTokenBudgetGlobal: number;
  dailyTokenBudgetPerProject: number;
}

export interface ProviderRateInfo {
  remainingTokens: number | null;
  resetAt: Date | null;
}

/** Margen mínimo de tokens que debe quedar según el proveedor para intentar otra llamada. */
const MIN_PROVIDER_TOKENS = 600;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const RULES_STILL_WORK = 'Las comprobaciones por reglas siguen funcionando.';

/**
 * Límites de uso de la IA (FR-024a): por persona y minuto, y presupuesto diario de tokens global y
 * por proyecto (día UTC). Las cabeceras de límite del proveedor prevalecen sobre el contador local.
 */
export class AgentBudget {
  private provider: ProviderRateInfo | null = null;

  constructor(
    private readonly store: BudgetStore,
    private readonly clock: Clock,
    private readonly limits: BudgetLimits,
  ) {}

  /** Registra lo que dijo el proveedor en su última respuesta (tokens restantes y restablecimiento). */
  observeProvider(info: ProviderRateInfo): void {
    this.provider = info;
  }

  /** Lanza `RATE_LIMITED` o `AI_BUDGET_EXCEEDED` (429) si no se puede llamar al modelo ahora. */
  async check(userId: string, projectId: string): Promise<void> {
    const now = this.clock.now();

    const recent = await this.store.callsSince(userId, new Date(now.getTime() - 60_000));
    if (recent >= this.limits.userRatePerMinute) {
      throw new AppError('RATE_LIMITED', 429, 'Hizo demasiadas preguntas al asistente en poco tiempo. Espere un minuto e intente de nuevo.');
    }

    const resetsAt = this.nextReset(now);
    const exceeded = (what: string, at: Date) =>
      new AppError(
        'AI_BUDGET_EXCEEDED',
        429,
        `${what} Se restablece a las ${at.toISOString().slice(11, 16)} UTC del ${at.toISOString().slice(0, 10)}. ${RULES_STILL_WORK}`,
      );

    if (this.provider?.resetAt && this.provider.resetAt > now && this.provider.remainingTokens !== null && this.provider.remainingTokens < MIN_PROVIDER_TOKENS) {
      throw exceeded('El cupo del servicio de IA se agotó.', this.provider.resetAt);
    }

    const since = startOfUtcDay(now);
    if ((await this.store.tokensSince(since)) >= this.limits.dailyTokenBudgetGlobal) {
      throw exceeded('El asistente alcanzó el cupo diario de uso de todos los equipos.', resetsAt);
    }
    if ((await this.store.tokensSince(since, projectId)) >= this.limits.dailyTokenBudgetPerProject) {
      throw exceeded('Este proyecto alcanzó su cupo diario de uso del asistente.', resetsAt);
    }
  }

  private nextReset(now: Date): Date {
    return new Date(startOfUtcDay(now).getTime() + 24 * 60 * 60 * 1000);
  }
}

/** Contadores reales a partir de las interacciones guardadas. */
export class PrismaBudgetStore implements BudgetStore {
  constructor(private readonly db: Db) {}

  callsSince(userId: string, since: Date): Promise<number> {
    return this.db.agentInteraction.count({ where: { userId, createdAt: { gte: since } } });
  }

  async tokensSince(since: Date, projectId?: string): Promise<number> {
    const sum = await this.db.agentInteraction.aggregate({
      where: { createdAt: { gte: since }, ...(projectId ? { projectId } : {}) },
      _sum: { inputTokens: true, outputTokens: true },
    });
    return (sum._sum.inputTokens ?? 0) + (sum._sum.outputTokens ?? 0);
  }
}
