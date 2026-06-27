import { MODE_META, PRIORITY_META } from '../constants';
import { useBoardUiStore } from '../store/boardUiStore';
import type { ModeFilter, PriorityFilter } from '../store/boardUiStore';
import type { Priority, ShipMode } from '../types';

const MODE_OPTIONS: readonly ShipMode[] = ['ocean', 'air', 'rail', 'ground'];
const PRIORITY_OPTIONS: readonly Priority[] = ['low', 'medium', 'high', 'critical'];

const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none';

export function BoardToolbar() {
  const search = useBoardUiStore((state) => state.search);
  const mode = useBoardUiStore((state) => state.mode);
  const priority = useBoardUiStore((state) => state.priority);
  const setSearch = useBoardUiStore((state) => state.setSearch);
  const setMode = useBoardUiStore((state) => state.setMode);
  const setPriority = useBoardUiStore((state) => state.setPriority);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search ref, route, title…"
        aria-label="Search tasks"
        className="min-w-[14rem] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />
      <select
        value={mode}
        aria-label="Filter by mode"
        className={selectClass}
        onChange={(event) => setMode(event.target.value as ModeFilter)}
      >
        <option value="all">All modes</option>
        {MODE_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {MODE_META[value].label}
          </option>
        ))}
      </select>
      <select
        value={priority}
        aria-label="Filter by priority"
        className={selectClass}
        onChange={(event) => setPriority(event.target.value as PriorityFilter)}
      >
        <option value="all">All priorities</option>
        {PRIORITY_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {PRIORITY_META[value].label}
          </option>
        ))}
      </select>
    </div>
  );
}
