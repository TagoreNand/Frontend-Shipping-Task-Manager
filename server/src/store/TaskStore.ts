import type { Task } from '../domain/types';

/**
 * Persistence boundary. The JSON implementation ships here; a SQL/Postgres store
 * is a drop-in replacement behind this same interface.
 */
export interface TaskStore {
  read(): Promise<Task[]>;
  /** Serialized read-modify-write — the only way to mutate, so writes never race. */
  mutate(mutator: (tasks: Task[]) => Task[]): Promise<Task[]>;
}
