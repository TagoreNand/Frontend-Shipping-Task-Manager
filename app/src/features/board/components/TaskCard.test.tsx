import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import type { Task } from '../types';

const task: Task = {
  id: 'task-1',
  ref: 'OCN-1042',
  title: 'Container — Electronics',
  description: 'High-value consumer electronics.',
  mode: 'ocean',
  origin: 'Shanghai',
  destination: 'Hamburg',
  priority: 'high',
  status: 'backlog',
  etaAt: '2025-06-01T00:00:00.000Z',
  updatedAt: '2025-06-01T00:00:00.000Z',
  order: 'a1',
};

function renderCard() {
  return render(
    <DndContext>
      <SortableContext items={[task.id]}>
        <TaskCard task={task} />
      </SortableContext>
    </DndContext>,
  );
}

describe('TaskCard', () => {
  it('renders reference, title, priority and ETA', () => {
    renderCard();
    expect(screen.getByText('OCN-1042')).toBeInTheDocument();
    expect(screen.getByText('Container — Electronics')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText(/ETA/)).toBeInTheDocument();
  });

  it('exposes drag metadata for the DnD layer', () => {
    renderCard();
    const card = screen.getByText('Container — Electronics').closest('article');
    expect(card).toHaveAttribute('data-task-id', 'task-1');
    expect(card).toHaveAttribute('data-status', 'backlog');
  });
});
