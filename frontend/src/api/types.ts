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
  email?: string;
}

export interface Evidence {
  id: string;
  content: string;
  authorPseudonym: string;
  createdAt: string;
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
