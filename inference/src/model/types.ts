export type TaskStatus = 'backlog' | 'in-progress' | 'complete';
export type ShipMode = 'ocean' | 'air' | 'rail' | 'ground';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface TriageInputTask {
  id: string;
  status: TaskStatus;
  priority: Priority;
  mode: ShipMode;
  etaAt: string;
}

export interface TriageSuggestion {
  recommendedStatus: TaskStatus;
  recommendedPriority: Priority;
  confidence: number;
  rationale: string;
}

export interface ScoredTask extends TriageSuggestion {
  taskId: string;
}

export interface Features {
  nearness: number;
  critical: number;
  air: number;
  fromBacklog: number;
  fromInProgress: number;
  fromComplete: number;
}

export interface ModelArtifact {
  version: string;
  trainedAt?: string;
  classes: TaskStatus[];
  features: string[];
  weights: Record<TaskStatus, Record<string, number>>;
  metrics?: { samples: number; accuracy: number };
}
