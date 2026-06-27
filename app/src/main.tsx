import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createQueryClient } from '@/lib/queryClient';
import { tracer } from '@/lib/telemetry';
import { createOtlpExporter, parseHeaders } from '@/lib/otlpExporter';
import App from './App';
import './index.css';

const otlpUrl = import.meta.env.VITE_OTLP_URL;
if (otlpUrl) {
  const resourceAttributes: Record<string, string> = {
    'service.name': import.meta.env.VITE_SERVICE_NAME ?? 'shiptivitas-app',
    'service.version': import.meta.env.VITE_SERVICE_VERSION ?? '0.0.0',
    'deployment.environment': import.meta.env.VITE_DEPLOY_ENV ?? import.meta.env.MODE,
  };
  const sampleRate = Number(import.meta.env.VITE_OTLP_SAMPLE_RATE ?? '1');
  const headers = parseHeaders(import.meta.env.VITE_OTLP_HEADERS);
  tracer.subscribe(createOtlpExporter({ endpoint: otlpUrl, resourceAttributes, sampleRate, headers }));
}

const queryClient = createQueryClient();
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
