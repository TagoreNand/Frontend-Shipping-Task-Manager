import type { TaskStatus, TasksByStatus } from '../types';
import { TASK_STATUSES } from '../types';

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export interface DropResolution {
  toStatus: TaskStatus;
  toIndex: number;
}

/**
 * Translate a dnd-kit (activeId, overId) pair into a domain move. `overId` is
 * either a lane id (drop onto empty space → append) or a card id (insert at its
 * position). Pure, so it is unit-tested without rendering anything.
 */
export function resolveDrop(
  groups: TasksByStatus,
  activeId: string,
  overId: string,
): DropResolution | null {
  const fromStatus = TASK_STATUSES.find((status) =>
    groups[status].some((task) => task.id === activeId),
  );
  if (!fromStatus) {
    return null;
  }

  if (isTaskStatus(overId)) {
    return { toStatus: overId, toIndex: groups[overId].length };
  }

  const toStatus = TASK_STATUSES.find((status) =>
    groups[status].some((task) => task.id === overId),
  );
  if (!toStatus) {
    return null;
  }

  const overIndex = groups[toStatus].findIndex((task) => task.id === overId);
  return { toStatus, toIndex: overIndex < 0 ? groups[toStatus].length : overIndex };
}
