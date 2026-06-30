# Shiptivitas Server

Persistence + realtime + auth backend for the Shiptivitas board. Express + `ws`,
strict TypeScript, with a **Postgres** or **JSON-file** store, a **users table**
with hashed passwords, token-refresh auth, and **OTLP** trace export.

## Run

```bash
npm install
npm run dev            # tsx watch, http://localhost:4000
# or: npm run build && npm start
```

### Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP/WS port |
| `API_TOKEN` | `dev-token` | static bearer token (always valid) |
| `REFRESH_TOKEN` | `dev-refresh` | seeded refresh token for `/auth/refresh` |
| `ACCESS_TTL_MS` | `300000` | lifetime of issued access tokens |
| `AUTH_USER` / `AUTH_PASSWORD` | `dispatcher` / `dev-password` | seeded dispatcher credentials |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `admin` / `admin-password` | seeded admin credentials |
| `DEMO_CUSTOMERS` | `acme,globex` | seeded `customer` accounts that own seed shipments |
| `DEMO_CUSTOMER_PASSWORD` | `customer-password` | shared password for the seeded demo customers |
| `DATABASE_URL` | — | set → Postgres (tasks + users); else JSON-file tasks + in-memory users |
| `DATA_FILE` | `./data/tasks.json` | JSON task store path |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | set → export request spans (OTLP/HTTP) |
| `OTEL_SERVICE_NAME` | `shiptivitas-server` | OTLP resource `service.name` |
| `DEPLOYMENT_ENVIRONMENT` | `development` | OTLP resource attribute |
| `OTEL_SAMPLE_RATE` | `1` | local head-based trace sample rate (0..1) |
| `REDIS_URL` | — | set → Redis token store (sessions survive restarts); else in-memory |
| `OTEL_EXPORTER_OTLP_HEADERS` | — | extra OTLP headers (`k=v,k=v`) for hosted vendors (e.g. Honeycomb) |
| `RISK_URL` | — | set → score transaction risk via the inference `/risk` service; else a local model |

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | no | status + live WS connection count |
| `POST` | `/auth/login` | no | `{ username, password }` → `{ accessToken, refreshToken, expiresInMs, user, role }` |
| `POST` | `/auth/signup` | no | self-service signup → a `customer` session (auto-login) |
| `POST` | `/auth/refresh` | no | `{ refreshToken }` → **rotated** `{ accessToken, refreshToken, expiresInMs }` |
| `GET` | `/tasks` | yes | tasks visible to the caller — staff see all; a `customer` sees only shipments they own (risk redacted) |
| `PATCH` | `/tasks/:id/move` | yes | `{ toStatus, toIndex }` → persist + broadcast; a `customer` may only move shipments they own (`403` otherwise) |
| `POST` | `/triage` | yes | `{ tasks[] }` → `{ suggestions[] }` (built-in heuristic) |
| `GET/POST` | `/users` | admin | list / create users |
| `PATCH/DELETE` | `/users/:id` | admin | change role / delete user |
| `POST` | `/me/password` | yes | self-service password change `{ currentPassword, newPassword }` |
| `GET` | `/audit` | admin | audit log, filterable by `?actor=&action=&limit=` |
| `GET` | `/metrics` | no | Prometheus metrics (token issue/reuse/evict + active gauges) |
| `GET` | `/risk/queue` | admin | flagged transactions awaiting review |
| `PATCH` | `/risk/:taskId` | admin | `{ action: approve \| block }` → resolve a held transaction |
| `WS` | `/realtime?token=…` | yes | `task-updated` + `heartbeat` pushes |

## Design

- **`UserStore`** — `/auth/login` verifies against a users store: scrypt-salted
  password hashes (`node:crypto`, no native deps), with in-memory and **Postgres**
  (`users` table, seeded) implementations.
- **`TokenService`** — opaque access tokens with TTL + refresh tokens; the static
  `API_TOKEN` stays valid for dev.
- **`TaskStore`** — `jsonStore` (atomic, mutex-serialized) or **`pgStore`** (tasks
  as `jsonb`, transactional), selected by `DATABASE_URL`.
- **Tracing** — every request propagates `x-trace-id` and (when `OTEL_*` is set)
  emits a SERVER span **under that same trace id**, so a move is one trace spanning
  the browser and the API.

- **Roles & rotation** — access tokens carry a `Principal {username, role}`; `requireRole('admin')` guards `/users`; each `/auth/refresh` **rotates** (invalidates the used refresh token, issues a new pair). Re-presenting a consumed refresh token is treated as **reuse/breach** → the whole session family is revoked.
- **Sampling** — the inbound `traceparent` sampled flag is honoured; otherwise a local head sampler (`OTEL_SAMPLE_RATE`) decides whether the SERVER span is exported.
- **Tracing** — parses W3C `traceparent` and emits a SERVER span that is a true **child** of the inbound span, so a move is one distributed trace across browser → API. W3C `baggage` (e.g. `enduser.role`) is parsed onto span attributes.

- **Persistent tokens** — access/refresh records live in a `TokenStore` (in-memory or **Redis** via `REDIS_URL`), so sessions + reuse-detection state survive restarts.
- **Metrics** — `GET /metrics` exposes Prometheus counters (tokens issued, reuse detected, families revoked, evicted) + active-token gauges; a periodic sweep evicts expired tokens from the in-memory store (Redis uses TTLs).
- **Audit log** — admin user mutations are recorded (`AuditLog`, in-memory or Postgres); `GET /audit` (admin) lists them.

- **Transaction risk** — every shipment carries a transaction; a risk engine combines deterministic rules (`high_value`, `new_account`, `restricted_lane`) and richer behavioural / geographic rules (`geo_risk` — origin or destination on the enhanced due-diligence list; `velocity` — an owner exceeding a rolling 24h shipment threshold) with an ML score (local model or the inference `/risk` service via `RISK_URL`) into an **approve / review / block** decision. `GET /tasks` is **role-redacted** — risk fields never reach a non-admin token; admins resolve held transactions from the risk queue (audited).
- **Per-customer ownership** — each shipment has an `owner`; `domain/ownership.ts` filters `GET /tasks` so a `customer` sees only their own shipments while staff (`dispatcher` / `admin`) see all, and enforces the same boundary on `/tasks/:id/move`. Rules are pure and context-aware: `assessTransactions` computes per-owner velocity once and threads it through a `RiskContext`, keeping the engine framework-free and unit-testable.

## Tests

```bash
npm test    # vitest: password hashing, user stores (mem + pg-mem), token service,
            # JSON + Postgres task stores, routes (login/refresh/move/triage/health),
            # OTLP exporter, hub, move
```
