/** Interfaz del servicio de IA: un único método, independiente del proveedor (research.md D-09). */

export interface LlmRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
}

export interface LlmResponse {
  text: string;
  /** Identificador del modelo que respondió (se registra en cada interacción, FR-025). */
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  /** Lo que el proveedor informó de sus límites (tokens restantes y restablecimiento). */
  rateLimit?: { remainingTokens: number | null; resetAt: Date | null };
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}

/** Se agotó el tiempo límite de la llamada (no se reintenta). */
export class LlmTimeoutError extends Error {
  constructor(message = 'Tiempo de espera agotado al consultar el modelo') {
    super(message);
    this.name = 'LlmTimeoutError';
  }
}

/** El proveedor rechazó por límite de uso (429). */
export class LlmRateLimitError extends Error {
  constructor(
    public readonly retryAfterMs: number | null = null,
    public readonly rateLimit?: { remainingTokens: number | null; resetAt: Date | null },
  ) {
    super('El proveedor de IA aplicó un límite de uso');
    this.name = 'LlmRateLimitError';
  }
}

/** Error transitorio o definitivo del proveedor (5xx, red, respuesta inesperada). */
export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}
