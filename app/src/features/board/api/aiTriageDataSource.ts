import type { Task } from '../types';
import { createLocalTriageService } from '../ai/triageService';
import type { TriageService } from '../ai/triageService';
import type { TasksDataSource } from './dataSource';

/**
 * Decorates any TasksDataSource with AI triage from a (local or remote)
 * TriageService. Being a drop-in TasksDataSource itself, it composes with the
 * mock or HTTP source without the UI/state layers knowing.
 */
export function createAiTriageDataSource(
  delegate: TasksDataSource,
  service: TriageService = createLocalTriageService(),
): TasksDataSource {
  const annotate = async (tasks: Task[]): Promise<Task[]> => {
    const suggestions = await service.scoreBatch(tasks);
    return tasks.map((task, index) => ({ ...task, aiSuggestion: suggestions[index] }));
  };
  return {
    async getTasks(signal) {
      return annotate(await delegate.getTasks(signal));
    },
    async moveTask(input, ctx) {
      return annotate(await delegate.moveTask(input, ctx));
    },
  };
}
