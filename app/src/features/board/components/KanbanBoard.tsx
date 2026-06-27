import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import clsx from 'clsx';
import { LANES } from '../constants';
import { filterTasks, groupByStatus } from '../lib/group';
import { resolveDrop } from '../lib/dnd';
import { newId } from '@/lib/telemetry';
import { useBoardUiStore } from '../store/boardUiStore';
import { useMoveTask } from '../hooks/useMoveTask';
import { useTasks } from '../hooks/useTasks';
import type { Task } from '../types';
import { BoardHeader } from './BoardHeader';
import { BoardStats } from './BoardStats';
import { BoardToolbar } from './BoardToolbar';
import { Swimlane } from './Swimlane';
import { TaskCardFace, cardClassName } from './TaskCard';

function BoardSkeleton() {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-5 lg:grid-cols-3" aria-busy="true" aria-label="Loading board">
      {LANES.map((lane) => (
        <div key={lane.id} className={clsx('h-72 animate-pulse rounded-xl', lane.surface)} />
      ))}
    </div>
  );
}

function BoardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md p-10 text-center">
      <p className="text-sm text-slate-600">We couldn't load the board.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  );
}

export function KanbanBoard() {
  const { data: tasks, isPending, isError, refetch } = useTasks();
  const move = useMoveTask();
  const search = useBoardUiStore((state) => state.search);
  const mode = useBoardUiStore((state) => state.mode);
  const priority = useBoardUiStore((state) => state.priority);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = useMemo(
    () => filterTasks(tasks ?? [], { search, mode, priority }),
    [tasks, search, mode, priority],
  );
  const groups = useMemo(() => groupByStatus(filtered), [filtered]);
  const activeTask = useMemo<Task | null>(
    () => (activeId ? (tasks ?? []).find((task) => task.id === activeId) ?? null : null),
    [activeId, tasks],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) {
        return;
      }
      const resolution = resolveDrop(groups, String(active.id), String(over.id));
      if (!resolution) {
        return;
      }
      move.mutate({
        input: { taskId: String(active.id), toStatus: resolution.toStatus, toIndex: resolution.toIndex },
        trace: { traceId: newId(), spanId: newId() },
      });
    },
    [groups, move],
  );

  const handleApplySuggestion = useCallback(
    (task: Task) => {
      const suggestion = task.aiSuggestion;
      if (!suggestion) {
        return;
      }
      move.mutate({
        input: { taskId: task.id, toStatus: suggestion.recommendedStatus, toIndex: 0 },
        trace: { traceId: newId(), spanId: newId() },
      });
    },
    [move],
  );

  if (isError) {
    return <BoardError onRetry={() => void refetch()} />;
  }
  if (isPending || !tasks) {
    return <BoardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5">
      <BoardHeader />
      <BoardStats tasks={tasks} />
      <BoardToolbar />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {LANES.map((lane) => (
            <Swimlane key={lane.id} lane={lane} tasks={groups[lane.id]} onApplySuggestion={handleApplySuggestion} />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className={clsx(cardClassName, 'cursor-grabbing shadow-lg')}>
              <TaskCardFace task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
