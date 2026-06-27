import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tracer } from '@/lib/telemetry';
import type { Span, TraceContext } from '@/lib/telemetry';
import { taskKeys } from '../api/queryKeys';
import { tasksDataSource } from '../api/tasksApi';
import { moveTask as applyMove } from '../lib/group';
import type { MoveTaskInput, Task } from '../types';

export interface MoveTaskVariables {
  input: MoveTaskInput;
  trace?: TraceContext;
}

interface MutationContext {
  previous: Task[] | undefined;
  span: Span;
}

/**
 * Optimistic move, traced. The `task.move` span is the root of the trace; the
 * apiClient's `http.request` span and the server's SERVER span nest under it via
 * a W3C `traceparent` header, so a move is one distributed trace.
 */
export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation<Task[], Error, MoveTaskVariables, MutationContext>({
    mutationFn: (variables) => tasksDataSource.moveTask(variables.input, variables.trace),
    onMutate: async ({ input, trace }) => {
      const span = tracer.startSpan('task.move', {
        traceId: trace?.traceId,
        spanId: trace?.spanId,
        fields: { taskId: input.taskId, toStatus: input.toStatus, toIndex: input.toIndex },
      });
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      const previous = queryClient.getQueryData<Task[]>(taskKeys.lists());
      if (previous) {
        queryClient.setQueryData<Task[]>(
          taskKeys.lists(),
          applyMove(previous, input.taskId, input.toStatus, input.toIndex),
        );
        span.event('optimistic.applied');
      }
      return { previous, span };
    },
    onSuccess: (_data, _variables, context) => {
      context?.span.event('server.ack');
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.lists(), context.previous);
        context.span.event('rollback');
      }
      context?.span.event('error');
    },
    onSettled: (_data, error, _variables, context) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      context?.span.end(error ? 'error' : 'ok');
    },
  });
}
