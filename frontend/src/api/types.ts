import type { ProjectStatus, Role, StageStatus, StageType } from '@scrum/shared';

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
