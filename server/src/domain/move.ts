import { keyBetween } from './fractionalIndex';
import type { Task, TaskStatus } from './types';

const byOrder = (a: Task, b: Task): number => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0);

export function applyMove(
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
  const lane = tasks.filter((task) => task.status === toStatus && task.id !== taskId).sort(byOrder);
  const index = Math.max(0, Math.min(toIndex, lane.length));
  const prev = index > 0 ? lane[index - 1].order : null;
  const next = index < lane.length ? lane[index].order : null;
  const order = keyBetween(prev, next);
  const updated: Task = { ...moving, status: toStatus, order, updatedAt: timestamp };
  return tasks.map((task) => (task.id === taskId ? updated : task));
}
