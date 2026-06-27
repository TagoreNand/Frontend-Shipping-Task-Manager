export type TaskStatus = 'backlog' | 'in-progress' | 'complete';
export type ShipMode = 'ocean' | 'air' | 'rail' | 'ground';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  ref: string;
  title: string;
  description: string;
  mode: ShipMode;
  origin: string;
  destination: string;
  priority: Priority;
  status: TaskStatus;
  etaAt: string;
  updatedAt: string;
  order: string;
}

export interface MoveTaskInput {
  toStatus: TaskStatus;
  toIndex: number;
}
