import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Priority, ShipMode } from '../types';

export type ModeFilter = ShipMode | 'all';
export type PriorityFilter = Priority | 'all';

export interface BoardUiState {
  search: string;
  mode: ModeFilter;
  priority: PriorityFilter;
  selectedTaskId: string | null;
  setSearch: (search: string) => void;
  setMode: (mode: ModeFilter) => void;
  setPriority: (priority: PriorityFilter) => void;
  selectTask: (id: string | null) => void;
  reset: () => void;
}

const INITIAL: Pick<BoardUiState, 'search' | 'mode' | 'priority' | 'selectedTaskId'> = {
  search: '',
  mode: 'all',
  priority: 'all',
  selectedTaskId: null,
};

/**
 * Lean client/UI state. Server state lives in TanStack Query; this store only
 * holds view preferences and ephemeral selection. Filters are persisted.
 */
export const useBoardUiStore = create<BoardUiState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setSearch: (search) => set({ search }),
      setMode: (mode) => set({ mode }),
      setPriority: (priority) => set({ priority }),
      selectTask: (selectedTaskId) => set({ selectedTaskId }),
      reset: () => set(INITIAL),
    }),
    {
      name: 'shiptivitas:board-ui',
      partialize: (state) => ({ search: state.search, mode: state.mode, priority: state.priority }),
    },
  ),
);
