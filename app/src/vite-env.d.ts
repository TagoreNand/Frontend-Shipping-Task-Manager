/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_AI_TRIAGE?: string;
  readonly VITE_TRIAGE_URL?: string;
  readonly VITE_SEED_COUNT?: string;
  readonly VITE_DEV_TOKEN?: string;
  readonly VITE_DEV_REFRESH_TOKEN?: string;
  readonly VITE_OTLP_URL?: string;
  readonly VITE_SERVICE_NAME?: string;
  readonly VITE_SERVICE_VERSION?: string;
  readonly VITE_DEPLOY_ENV?: string;
  readonly VITE_OTLP_SAMPLE_RATE?: string;
  readonly VITE_OTLP_HEADERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
