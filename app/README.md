# Shiptivitas — Logistics Control Tower (Frontend)

A production-grade rebuild of the Shiptivitas shipping board: drag-and-drop Kanban
with realtime telemetry, AI triage, scale, end-to-end auth (login + token refresh),
and request tracing exported over OTLP.

Part of a multi-service stack: `app/` (this) · `server/` (API) · `inference/`
(triage model) · `shiptivitas-1-master/` (original, reference). See the repo root
README for `docker compose up`.

## Highlights

| Area | What |
| --- | --- |
| Build / language | **Vite 8**, **TypeScript (strict)**, oxlint |
| Drag & drop | **@dnd-kit** (accessible) over a pure, fractional-index domain core |
| State | **TanStack Query** (server) + **Zustand** (UI, auth) |
| Data | mock ⇄ **HTTP backend**; AI triage via the inference service |
| Realtime | reconnecting **WebSocket** (token-authed) |
| Scale | **virtualized lanes** past a threshold |
| Auth | **login + roles**, bearer token on HTTP/WS, **rotation + reuse-breach detection**, admin **users UI**, self-service **password change** |
| Observability | optimistic-mutation tracing, **W3C `traceparent`** parent/child + **`baggage`** across app + API + inference, **OTLP export** (per-deploy attrs, **head sampling**, vendor **headers**) |
| Tests | **Vitest + RTL + Playwright** (63 unit/component) |

## Architecture

```
src/
├── lib/                      apiClient (auth · trace · 401→refresh) · telemetry · otlpExporter · queryClient
├── features/
│   ├── auth/                 authStore (login/refresh/logout) · LoginScreen · AuthGate
│   ├── observability/        TracePanel (dev)
│   └── board/                lib (group/move · fractionalIndex · dnd) · ai · api · store · hooks · components
```

## Run

```bash
# frontend only (in-memory mock — no backend):
npm install && npm run dev                 # http://localhost:5173

# against the backend + inference service:
#   (start ../server and ../inference first, or use the root docker compose)
cp .env.example .env                        # set VITE_USE_MOCK=false
npm run dev
```

### Environment

```bash
VITE_USE_MOCK=true                          # false → HTTP backend + WebSocket + login
VITE_API_BASE_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000/realtime
VITE_TRIAGE_URL=http://localhost:4100       # base URL; client POSTs to ${URL}/triage
VITE_AI_TRIAGE=true
VITE_SEED_COUNT=                            # e.g. 600 → stress-test virtualization
VITE_DEV_TOKEN=dev-token                    # (mock mode only) seeded access token
VITE_DEV_REFRESH_TOKEN=dev-refresh
VITE_OTLP_URL=                              # e.g. http://localhost:4318 → export spans
VITE_OTLP_SAMPLE_RATE=1                      # head-based trace sample rate 0..1
VITE_OTLP_HEADERS=                           # vendor auth headers, e.g. x-honeycomb-team=KEY
VITE_SERVICE_NAME=shiptivitas-app           # OTLP resource attributes …
VITE_SERVICE_VERSION=0.1.0
VITE_DEPLOY_ENV=development
```

## Auth & observability

- **Login + refresh:** in backend mode the board is gated by `AuthGate`/`LoginScreen`
  (demo: `dispatcher` / `dev-password`). `login()` calls `/auth/login`; tokens live in
  `authStore`. On a 401 `apiClient` runs a **single-flight** `refreshAccessToken()`
  and retries once; a failed refresh clears the session (back to login). Mock mode
  skips auth entirely. Admins (role `admin`) get a **Users** panel — list/create/change-role/delete via `/users`; each refresh **rotates** the refresh token.
- **Tracing + OTLP:** `useMoveTask` spans the optimistic lifecycle; `apiClient` spans
  each request and propagates `x-trace-id` (the server logs it). When `VITE_OTLP_URL`
  is set, spans are converted (`spansToOtlp`) with per-deployment **resource
  attributes** and batched to an OTLP/HTTP collector. The dev **Trace panel** lists
  recent spans.
- **AI triage:** points at the standalone **inference service** (`VITE_TRIAGE_URL`),
  falling back to the bundled heuristic on any error.

## Testing

Unit: pure core (group/move, fractional-index property test), data sources, triage
service (stubbed fetch + fallback), WebSocket channel, **auth store + login + refresh**,
tracer, **apiClient** (auth/trace, 401→refresh→retry), **OTLP** converter + batcher.
Component/hook: `TaskCard`, `useMoveTask`, `useBoardRealtime`, `Swimlane`
virtualization, **LoginScreen**. E2E: Playwright. CI runs the full gate.
