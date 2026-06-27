import { describe, expect, it } from 'vitest';
import { createMetrics } from './metrics';

describe('createMetrics', () => {
  it('tracks counters and gauges and renders Prometheus text', () => {
    const m = createMetrics();
    m.counter('reqs_total', 'requests');
    m.gauge('active', 'active');
    m.inc('reqs_total');
    m.inc('reqs_total', 4);
    m.set('active', 7);
    const out = m.render();
    expect(out).toContain('# TYPE reqs_total counter');
    expect(out).toContain('reqs_total 5');
    expect(out).toContain('# TYPE active gauge');
    expect(out).toContain('active 7');
  });
});
