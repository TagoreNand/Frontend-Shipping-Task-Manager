import type { Principal } from '../auth/tokenStore';
import type { Task } from './types';

/** Staff roles see every shipment; customers see only their own. */
export function isStaff(role: string | undefined): boolean {
  return role === 'admin' || role === 'dispatcher';
}

/** Can this principal act on / see this specific task? */
export function ownsTask(task: Task, principal: Principal | undefined): boolean {
  if (!principal) {
    return false;
  }
  if (isStaff(principal.role)) {
    return true;
  }
  return task.owner === principal.username;
}

/** The subset of tasks a principal may see: all for staff, owned-only for customers. */
export function visibleTasks(tasks: readonly Task[], principal: Principal | undefined): Task[] {
  if (principal && isStaff(principal.role)) {
    return tasks.slice();
  }
  if (!principal) {
    return [];
  }
  return tasks.filter((task) => task.owner === principal.username);
}
