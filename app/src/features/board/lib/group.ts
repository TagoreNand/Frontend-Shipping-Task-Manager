import type { Priority, ShipMode, Task, TaskStatus, TasksByStatus } from '../types';
import { TASK_STATUSES } from '../types';
import { keyBetween } from './fractionalIndex';

/** An empty, fully-populated lane map (every status key present). */
export function emptyGroups(): TasksByStatus {
  return { backlog: [], 'in-progress': [], complete: [] };
}

/** Group tasks into lanes, each sorted by its fractional `order` key. Pure. */
export function groupByStatus(tasks: readonly Task[]): TasksByStatus {
  const groups = emptyGroups();
  for (const task of tasks) {
    groups[task.status].push(task);
  }
  for (const status of TASK_STATUSES) {
    groups[status].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  }
  return groups;
}

/**
 * Move a task to `toStatus` at `toIndex` by assigning a fractional key between
 * its new neighbours. Only the moved task changes — no full-lane re-index — so
 * concurrent/optimistic updates don't clobber unrelated rows. Pure and
 * framework-agnostic: the single source of truth for board mutations.
 */
export function moveTask(
  tasks: readonly Task[],
  taskId: string,
  toStatus: TaskStatus,
  toIndex: number,
  timestamp: string = new Date().toISOString(),
): Task[] {
  const moving = tasks.find((task) => task.id === taskId);
  if (!moving) {
    return tasks.slice();
  }

  const lane = groupByStatus(tasks)[toStatus].filter((task) => task.id !== taskId);
  const index = Math.max(0, Math.min(toIndex, lane.length));
  const prev = index > 0 ? lane[index - 1].order : null;
  const next = index < lane.length ? lane[index].order : null;
  const order = keyBetween(prev, next);

  const updated: Task = { ...moving, status: toStatus, order, updatedAt: timestamp };
  return tasks.map((task) => (task.id === taskId ? updated : task));
}

/** True when a task carries an AI suggestion that disagrees with its lane. */
export function hasActionableSuggestion(task: Task): boolean {
  return task.aiSuggestion !== undefined && task.aiSuggestion.recommendedStatus !== task.status;
}

export interface BoardStats {
  total: number;
  byStatus: Record<TaskStatus, number>;
  completionRate: number;
  critical: number;
  aiFlags: number;
}

export function computeStats(tasks: readonly Task[]): BoardStats {
  const byStatus: Record<TaskStatus, number> = { backlog: 0, 'in-progress': 0, complete: 0 };
  let critical = 0;
  let aiFlags = 0;
  for (const task of tasks) {
    byStatus[task.status] += 1;
    if (task.priority === 'critical') {
      critical += 1;
    }
    if (hasActionableSuggestion(task)) {
      aiFlags += 1;
    }
  }
  const total = tasks.length;
  return {
    total,
    byStatus,
    completionRate: total === 0 ? 0 : byStatus.complete / total,
    critical,
    aiFlags,
  };
}

export interface BoardFilters {
  search: string;
  mode: ShipMode | 'all';
  priority: Priority | 'all';
}

export function filterTasks(tasks: readonly Task[], filters: BoardFilters): Task[] {
  const query = filters.search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (filters.mode !== 'all' && task.mode !== filters.mode) {
      return false;
    }
    if (filters.priority !== 'all' && task.priority !== filters.priority) {
      return false;
    }
    if (query.length > 0) {
      const haystack = `${task.ref} ${task.title} ${task.origin} ${task.destination}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}
