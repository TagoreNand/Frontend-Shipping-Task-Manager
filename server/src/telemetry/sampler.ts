/** Deterministic head-based sampling: a trace id maps to a stable [0,1) fraction. */
export function shouldSample(traceId: string, rate: number): boolean {
  if (rate >= 1) {
    return true;
  }
  if (rate <= 0) {
    return false;
  }
  let hash = 2166136261;
  for (let i = 0; i < traceId.length; i += 1) {
    hash ^= traceId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296 < rate;
}
