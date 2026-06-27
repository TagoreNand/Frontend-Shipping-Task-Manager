/** Centralised, type-safe query-key factory (TanStack Query best practice). */
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
};
