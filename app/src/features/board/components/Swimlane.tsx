import { memo, useCallback, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { shouldVirtualize } from '../constants';
import type { LaneMeta } from '../constants';
import type { Task } from '../types';
import { TaskCard } from './TaskCard';

interface LaneBodyProps {
  laneId: LaneMeta['id'];
  tasks: Task[];
  onApplySuggestion?: (task: Task) => void;
}

const bodyBase = 'min-h-[18rem] flex-1 rounded-lg p-1 transition-colors';

function PlainLaneBody({ laneId, tasks, onApplySuggestion }: LaneBodyProps) {
  const { setNodeRef, isOver } = useDroppable({ id: laneId });
  return (
    <div
      ref={setNodeRef}
      data-lane={laneId}
      className={clsx(bodyBase, 'flex flex-col gap-2', isOver && 'ring-2 ring-inset ring-blue-300')}
    >
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onApplySuggestion={onApplySuggestion} />
      ))}
      {tasks.length === 0 && (
        <div className="flex h-28 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-400">
          Drop tasks here
        </div>
      )}
    </div>
  );
}

function VirtualLaneBody({ laneId, tasks, onApplySuggestion }: LaneBodyProps) {
  const { setNodeRef, isOver } = useDroppable({ id: laneId });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (element: HTMLDivElement | null) => {
      scrollRef.current = element;
      setNodeRef(element);
    },
    [setNodeRef],
  );

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 116,
    overscan: 8,
    getItemKey: (index) => tasks[index].id,
  });

  return (
    <div
      ref={setRefs}
      data-lane={laneId}
      className={clsx(bodyBase, 'max-h-[70vh] overflow-auto', isOver && 'ring-2 ring-inset ring-blue-300')}
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              paddingBottom: '8px',
              transform: `translateY(${item.start}px)`,
            }}
          >
            <TaskCard task={tasks[item.index]} onApplySuggestion={onApplySuggestion} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface SwimlaneProps {
  lane: LaneMeta;
  tasks: Task[];
  onApplySuggestion?: (task: Task) => void;
}

function SwimlaneComponent({ lane, tasks, onApplySuggestion }: SwimlaneProps) {
  const ids = tasks.map((task) => task.id);
  const Body = shouldVirtualize(tasks.length) ? VirtualLaneBody : PlainLaneBody;

  return (
    <section className={clsx('flex w-full flex-col rounded-xl p-3', lane.surface)} aria-label={`${lane.title} lane`}>
      <header className="mb-3 flex items-center justify-between">
        <h2 className={clsx('text-sm font-bold uppercase tracking-wide', lane.heading)}>{lane.title}</h2>
        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
          {tasks.length}
          <span className={clsx('h-2.5 w-2.5 rounded-full', lane.dot)} aria-hidden />
        </span>
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <Body laneId={lane.id} tasks={tasks} onApplySuggestion={onApplySuggestion} />
      </SortableContext>
    </section>
  );
}

export const Swimlane = memo(SwimlaneComponent);
