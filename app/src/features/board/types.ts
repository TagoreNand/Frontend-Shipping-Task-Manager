export type TaskStatus = 'backlog' | 'in-progress' | 'complete';

export const TASK_STATUSES = ['backlog', 'in-progress', 'complete'] as const satisfies readonly TaskStatus[];

export type ShipMode = 'ocean' | 'air' | 'rail' | 'ground';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

/** An AI triage recommendation attached to a task by the triage data source. */
export interface TriageSuggestion {
  recommendedStatus: TaskStatus;
  recommendedPriority: Priority;
  /** 0..1 model confidence. */
  confidence: number;
  rationale: string;
}

/** Core domain entity: a single shipping task on the operational board. */
export interface Task {
  id: string;
  /** Human reference, e.g. "OCN-1042". */
  ref: string;
  title: string;
  description: string;
  mode: ShipMode;
  origin: string;
  destination: string;
  priority: Priority;
  status: TaskStatus;
  /** ISO timestamp — estimated time of arrival. */
  etaAt: string;
  /** ISO timestamp — last mutation, used for realtime reconciliation. */
  updatedAt: string;
  /** Fractional index key — lexicographically sortable position within its lane. */
  order: string;
  /** Optional AI triage recommendation (populated by the triage data source). */
  aiSuggestion?: TriageSuggestion;
}

export type TasksByStatus = Record<TaskStatus, Task[]>;

export interface MoveTaskInput {
  taskId: string;
  toStatus: TaskStatus;
  toIndex: number;
}
