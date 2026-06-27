import { useQuery } from '@tanstack/react-query';
import { taskKeys } from '../api/queryKeys';
import { tasksDataSource } from '../api/tasksApi';

export function useTasks() {
  return useQuery({
    queryKey: taskKeys.lists(),
    queryFn: ({ signal }) => tasksDataSource.getTasks(signal),
  });
}
