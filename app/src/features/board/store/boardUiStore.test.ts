import { beforeEach, describe, expect, it } from 'vitest';
import { useBoardUiStore } from './boardUiStore';

describe('boardUiStore', () => {
  beforeEach(() => {
    useBoardUiStore.getState().reset();
  });

  it('has sensible defaults', () => {
    const state = useBoardUiStore.getState();
    expect(state.search).toBe('');
    expect(state.mode).toBe('all');
    expect(state.priority).toBe('all');
  });

  it('updates filters', () => {
    useBoardUiStore.getState().setSearch('ocn');
    useBoardUiStore.getState().setMode('air');
    useBoardUiStore.getState().setPriority('critical');
    const state = useBoardUiStore.getState();
    expect(state.search).toBe('ocn');
    expect(state.mode).toBe('air');
    expect(state.priority).toBe('critical');
  });

  it('reset returns to defaults', () => {
    useBoardUiStore.getState().setSearch('x');
    useBoardUiStore.getState().reset();
    expect(useBoardUiStore.getState().search).toBe('');
  });
});
