export { CATALOG_VERSION, GATES, getGate } from './catalog/index.js';
export type { CriterionDef, GateDef } from './catalog/types.js';
export { evaluate, evaluateWithRules, type EngineRun, type EngineResult, type RunStatus } from './engine.js';
export { deriveGateState, type LatestRun } from './gate-state.js';
export type { RuleFn, RuleOutput, RuleSet } from './rules/types.js';
export { STORY_RULES, findVagueTerms, type StorySnapshot } from './rules/story.js';
export { PLAN_RULES, type PlanItem, type PlanSnapshot } from './rules/plan.js';
