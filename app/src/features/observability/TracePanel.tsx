import { useEffect, useState } from 'react';
import { tracer } from '@/lib/telemetry';
import type { CompletedSpan } from '@/lib/telemetry';

/** Dev-only panel that lists recent spans from the tracer. */
export function TracePanel() {
  const [spans, setSpans] = useState<CompletedSpan[]>(() => [...tracer.recent()].reverse());
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      tracer.subscribe((span) => {
        setSpans((prev) => [span, ...prev].slice(0, 25));
      }),
    [],
  );

  return (
    <div className="fixed bottom-3 right-3 z-50 text-xs">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-slate-300 bg-white px-3 py-1 font-medium text-slate-600 shadow-sm hover:bg-slate-50"
      >
        Traces · {spans.length}
      </button>
      {open && (
        <div className="mt-2 max-h-80 w-80 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {spans.length === 0 ? (
            <p className="p-2 text-slate-400">No traces yet — drag a card.</p>
          ) : (
            spans.map((span) => (
              <div key={span.id} className="border-b border-slate-100 py-1.5 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-700">{span.name}</span>
                  <span className={span.status === 'ok' ? 'text-green-600' : 'text-red-600'}>{span.durationMs}ms</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {span.traceId.slice(0, 8)}
                  {span.events.length > 0 && ` · ${span.events.map((event) => event.name).join(' → ')}`}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
