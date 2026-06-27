type MetricType = 'counter' | 'gauge';

interface Metric {
  type: MetricType;
  help: string;
  value: number;
}

/** Tiny Prometheus-style metrics registry (counters + gauges). */
export interface Metrics {
  counter(name: string, help: string): void;
  gauge(name: string, help: string): void;
  inc(name: string, by?: number): void;
  set(name: string, value: number): void;
  render(): string;
}

export function createMetrics(): Metrics {
  const metrics = new Map<string, Metric>();
  return {
    counter(name, help) {
      if (!metrics.has(name)) {
        metrics.set(name, { type: 'counter', help, value: 0 });
      }
    },
    gauge(name, help) {
      if (!metrics.has(name)) {
        metrics.set(name, { type: 'gauge', help, value: 0 });
      }
    },
    inc(name, by = 1) {
      const metric = metrics.get(name);
      if (metric) {
        metric.value += by;
      }
    },
    set(name, value) {
      const metric = metrics.get(name);
      if (metric) {
        metric.value = value;
      }
    },
    render() {
      const lines: string[] = [];
      for (const [name, metric] of metrics) {
        lines.push(`# HELP ${name} ${metric.help}`);
        lines.push(`# TYPE ${name} ${metric.type}`);
        lines.push(`${name} ${metric.value}`);
      }
      return `${lines.join('\n')}\n`;
    },
  };
}
