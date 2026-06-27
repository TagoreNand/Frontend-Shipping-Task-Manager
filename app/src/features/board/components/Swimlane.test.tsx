import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { Swimlane } from './Swimlane';
import { LANES, shouldVirtualize } from '../constants';
import { generateKeys } from '../lib/fractionalIndex';
import type { Task } from '../types';

function manyTasks(n: number): Task[] {
  const now = new Date().toISOString();
  return generateKeys(n).map((order, index) => ({
    id: `t${index}`,
    ref: `R-${index}`,
    title: `Task ${index}`,
    description: '',
    mode: 'ocean',
    origin: 'A',
    destination: 'B',
    priority: 'low',
    status: 'backlog',
    etaAt: now,
    updatedAt: now,
    order,
  }));
}

describe('shouldVirtualize', () => {
  it('switches on past the threshold', () => {
    expect(shouldVirtualize(10)).toBe(false);
    expect(shouldVirtualize(50)).toBe(true);
  });
});

describe('Swimlane virtualization', () => {
  it('windows a large lane while still reporting the full count', () => {
    render(
      <DndContext>
        <Swimlane lane={LANES[0]} tasks={manyTasks(50)} />
      </DndContext>,
    );
    expect(screen.getByRole('region', { name: 'Backlog lane' })).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    // a windowed lane mounts only a subset of its 50 cards
    expect(screen.queryAllByRole('article').length).toBeLessThan(50);
  });
});
