import type { Outcome } from '@scrum/shared';

/** Salida de una regla determinista para un criterio. */
export interface RuleOutput {
  outcome: Outcome;
  /** Valor o fragmento comprobado (evidencia). */
  evidence?: string;
  /** Por qué no se cumple (solo con NOT_MET). */
  explanation?: string;
  /** Qué hacer para corregirlo (solo con NOT_MET). */
  recommendation?: string;
}

export type RuleFn<S> = (snapshot: S) => RuleOutput;

/** Reglas indexadas por identificador de criterio. */
export type RuleSet<S> = Partial<Record<string, RuleFn<S>>>;
