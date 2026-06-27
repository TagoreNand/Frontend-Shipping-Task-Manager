import path from 'node:path';
import { createApp } from './app';
import { loadModel } from './model/load';
import { createOtlpExporter, parseHeaders } from './telemetry/otlp';
import { log } from './logger';

const PORT = Number(process.env.PORT) || 4100;
const MODEL_PATH = process.env.MODEL_PATH ?? path.join(process.cwd(), 'model.json');

const model = loadModel(MODEL_PATH);
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const otlp = otlpEndpoint
  ? createOtlpExporter({
      endpoint: otlpEndpoint,
      resourceAttributes: {
        'service.name': process.env.OTEL_SERVICE_NAME ?? 'shiptivitas-inference',
        'service.version': model.version,
        'deployment.environment': process.env.DEPLOYMENT_ENVIRONMENT ?? 'development',
      },
      headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
    })
  : undefined;

createApp(model, otlp).listen(PORT, () => log('info', 'inference.listening', { port: PORT, model: model.version }));
