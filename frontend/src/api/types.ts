import type { GateState, ProjectStatus, Role, StageStatus, StageType } from '@scrum/shared';

export interface Me {
  id: string;
  email: string;
  pseudonym: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  productGoal: string;
  definitionOfDone: string;
  isSample: boolean;
  version: number;
  createdAt: string;
}

export interface ProjectSummary extends Project {
  myRole: Role;
  status: ProjectStatus;
}

export interface Stage {
  type: StageType;
  status: StageStatus;
  startedAt: string | null;
  completedAt: string | null;
  gateState: GateState | null;
}

export interface Sprint {
  id: string;
  number: number;
  status: 'OPEN' | 'CLOSED';
  sprintGoal: string;
  workPlan: string;
  version: number;
  itemIds: string[];
  stages: Stage[];
}

export interface ProjectDetail extends ProjectSummary {
  openSprint: Sprint | null;
}

export interface Member {
  userId: string;
  pseudonym: string;
  role: Role;
  responsibilities: ScrumResponsibilityValue[];
  email?: string;
}

export interface Evidence {
  id: string;
  content: string;
  authorPseudonym: string;
  createdAt: string;
  stageType: string;
  attachment: { fileName: string; mimeType: string; sizeBytes: number } | null;
}

export interface Activity {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  actorPseudonym: string | null;
  occurredAt: string;
}

export interface BacklogItem {
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
  gateState: GateState;
  updatedAt: string;
}

export interface CriterionResult {
  criterionId: string;
  origin: 'OFFICIAL' | 'ADDITIONAL';
  mandatory: boolean;
  outcome: 'MET' | 'NOT_MET' | 'NOT_APPLICABLE';
  evidence: string;
  explanation: string;
  recommendation: string;
  source: 'RULE_CHECK';
}

export interface ValidationRun {
  id: string;
  gateId: string;
  targetType: string;
  targetId: string;
  targetVersion: number;
  attemptNo: number;
  status: 'PASSED' | 'FAILED' | 'ERROR';
  catalogVersion: string;
  aiStatus: string;
  results: CriterionResult[];
  aiObservations: AiObservation[];
  exception: { id: string; authorizedByPseudonym: string; justification: string; createdAt: string } | null;
  startedAt: string;
  finishedAt: string;
}

export interface CriteriaCatalog {
  catalogVersion: string;
  gates: {
    gateId: string;
    title: string;
    blocking: boolean;
    criteria: { id: string; title: string; origin: 'OFFICIAL' | 'ADDITIONAL'; mandatory: boolean; scrumGuideNote: string | null }[];
  }[];
}

export interface AiObservation {
  criterionId: string | null;
  text: string;
  suggestedRewrite: string | null;
  source: 'AI_RECOMMENDATION';
}

export interface AgentReply {
  interactionId: string;
  answer: string;
  suggestions: { target: string; text: string }[];
  referencedCriteria: string[];
  proposals: Suggestion[];
  basis: 'DOCUMENTO' | 'INFERENCIA';
  sources: { document: string; section: string | null }[];
  contextUsed: { projectData: string[]; documents: { document: string; sections: string[] }[]; documentsAvailable: number; focus: string | null };
  providerNotice: string;
  disclaimer: string;
  source: 'AI_RECOMMENDATION';
  model: string;
}

export interface RetroAction {
  id: string;
  description: string;
  ownerId: string | null;
  ownerPseudonym: string | null;
  forNextSprint: boolean;
  status: 'OPEN' | 'DONE' | 'DISCARDED';
  followUpNote: string;
  followUpUpdatedAt: string | null;
  version: number;
}

export interface Retrospective {
  positives: string[];
  problems: string[];
  improvements: string[];
  version: number;
  gateState: GateState;
  sprintStatus: 'OPEN' | 'CLOSED';
  actions: RetroAction[];
  previousSprint: { id: string; number: number } | null;
  previousActions: RetroAction[];
}

export type TrackingKind = 'PROGRESS' | 'IMPEDIMENT' | 'OBSERVATION' | 'DAILY_NOTE';

export interface TrackingEntry {
  id: string;
  kind: TrackingKind;
  content: string;
  resolvedAt: string | null;
  authorPseudonym: string;
  createdAt: string;
}

export interface SprintReview {
  results: string;
  increment: string;
  feedback: string;
  goalAssessment: 'ACHIEVED' | 'PARTIAL' | 'NOT_ACHIEVED' | null;
  goalAssessmentNote: string;
  version: number;
  gateState: GateState;
  sprintStatus: 'OPEN' | 'CLOSED';
  sprintGoal: string;
}

// ---------------------------------------------------------------------------------------------
// Equipo, vistas por rol, documentos, decisiones y sugerencias de IA
// ---------------------------------------------------------------------------------------------

export type ScrumResponsibilityValue = 'SCRUM_MASTER' | 'PRODUCT_OWNER' | 'DEVELOPER';
export type TaskStatusValue = 'TODO' | 'DOING' | 'DONE';

export interface SprintTask {
  id: string;
  sprintId: string;
  backlogItemId: string | null;
  itemCode: string | null;
  itemTitle: string | null;
  title: string;
  status: TaskStatusValue;
  assigneeId: string | null;
  assigneePseudonym: string | null;
  fromAi: boolean;
  version: number;
}

export interface Decision {
  id: string;
  kind: 'DECISION' | 'AGREEMENT';
  text: string;
  authorPseudonym: string;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  status: 'ACTIVE' | 'OUTDATED';
  includeInContext: boolean;
  currentVersion: number;
  updatedAt: string;
  current: { version: number; fileName: string; mimeType: string; sizeBytes: number; uploadedAt: string; uploadedByPseudonym: string; usableAsContext: boolean };
}

export interface DocumentVersion {
  version: number;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByPseudonym: string;
  usableAsContext: boolean;
}

export interface StageSummary {
  type: string;
  status: string;
  gateState: GateState | null;
}

export interface AttentionItemDto {
  code: string;
  severity: 'info' | 'warning';
  message: string;
  count?: number;
}

export interface ScrumMasterView {
  project: { id: string; name: string; productGoal: string; definitionOfDone: string };
  sprint: { id: string; number: number; sprintGoal: string; stages: StageSummary[] } | null;
  impediments: { id: string; content: string; createdAt: string }[];
  retroActions: { id: string; description: string; sprintNumber: number; forNextSprint: boolean; ownerPseudonym: string | null; followUpNote: string }[];
  attention: AttentionItemDto[];
  decisions: Decision[];
}

export interface ProductOwnerView {
  project: { id: string; name: string; productGoal: string; definitionOfDone: string };
  backlog: {
    id: string;
    code: string;
    kind: 'USER_STORY' | 'ITEM';
    title: string;
    priority: number;
    asA: string | null;
    iWant: string | null;
    soThat: string | null;
    acceptanceCriteria: string[];
    gateState: GateState;
    needsClarification: boolean;
    reasons: string[];
    inSprint: boolean;
  }[];
  reviewFeedback: { sprintNumber: number; results: string; feedback: string; goalAssessment: string | null; goalAssessmentNote: string }[];
}

export interface DevelopersView {
  project: { id: string; name: string; productGoal: string; definitionOfDone: string };
  sprint: { id: string; number: number; sprintGoal: string; workPlan: string; stages: StageSummary[] } | null;
  items: { id: string; code: string; title: string; acceptanceCriteria: string[]; tasks: SprintTask[] }[];
  unlinkedTasks: SprintTask[];
  summary: { todo: number; doing: number; done: number };
  impediments: { id: string; content: string; createdAt: string }[];
}

export type SuggestionKindValue = 'STORY' | 'ACCEPTANCE_CRITERIA' | 'TASK' | 'FIELD_CHANGE' | 'RISK' | 'DEPENDENCY' | 'QUESTION';

export interface Suggestion {
  id: string;
  kind: SuggestionKindValue;
  status: 'PROPOSED' | 'ACCEPTED' | 'DISCARDED';
  actionable: boolean;
  title: string;
  text: string;
  asA: string | null;
  iWant: string | null;
  soThat: string | null;
  acceptanceCriteria: string[];
  itemId: string | null;
  itemCode: string | null;
  sources: { document: string; section: string | null }[];
  basis: 'REGLAS' | 'DOCUMENTO' | 'INFERENCIA';
  effect: string;
  source: 'AI_RECOMMENDATION';
  /** Solo propuestas FIELD_CHANGE: el campo de un artefacto con su valor actual y el propuesto. */
  change: {
    artifactType: string;
    artifactId: string;
    artifactLabel: string;
    field: string;
    fieldLabel: string;
    fieldKind: 'text' | 'list';
    currentValue: string | string[];
    proposedValue: string | string[];
    rationale: string;
    basis: 'REGLAS' | 'DOCUMENTO' | 'INFERENCIA';
    criterionIds: string[];
    hasRules: boolean;
  } | null;
}

export interface ResolvedSuggestion {
  suggestion: Suggestion;
  result: { entity: string | null; id: string | null };
  revalidation: { runId: string; gateId: string; status: string; attemptNo: number } | null;
  notice: string;
}

// ---------------------------------------------------------------------------------------------
// Recomendaciones por campo (panel del asistente)
// ---------------------------------------------------------------------------------------------

export type ArtifactTypeValue = 'BACKLOG_ITEM' | 'PROJECT' | 'SPRINT' | 'SPRINT_TASK' | 'TRACKING' | 'SPRINT_REVIEW' | 'RETROSPECTIVE' | 'RETRO_ACTION';
export type FieldValueDto = string | string[];

export interface FieldRecommendation {
  field: string;
  label: string;
  kind: 'text' | 'list';
  status: 'CHANGE' | 'NO_CHANGE' | 'UNSURE' | 'NO_RESPONSE';
  currentValue: FieldValueDto;
  proposedValue: FieldValueDto | null;
  rationale: string;
  basis: 'REGLAS' | 'DOCUMENTO' | 'INFERENCIA';
  criterionIds: string[];
  sources: { document: string; section: string | null }[];
  suggestion: Suggestion | null;
}

export interface Recommendation {
  interactionId: string;
  artifact: { type: ArtifactTypeValue; id: string; label: string; version: number | null; editable: boolean; hasRules: boolean };
  kind: 'RULES_AND_AI' | 'AI_ONLY';
  summary: string;
  fields: FieldRecommendation[];
  questions: string[];
  contextUsed: { projectData: string[]; documents: { document: string; sections: string[] }[]; documentsAvailable: number; focus: string | null };
  providerNotice: string;
  disclaimer: string;
  source: 'AI_RECOMMENDATION';
  model: string;
}
