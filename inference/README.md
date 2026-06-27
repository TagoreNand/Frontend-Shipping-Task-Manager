# Shiptivitas Inference Service

A standalone triage model service. A softmax **multinomial logistic regression**,
its weights **trained** and stored in `model.json`, scores each task's most likely
lane with a calibrated confidence — the production stand-in for the board's
bundled heuristic.

## Run

```bash
npm install
npm run dev            # tsx watch, http://localhost:4100
# or: npm run build && npm start
```

### Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4100` | HTTP port |
| `MODEL_PATH` | `./model.json` | model artifact (weights) loaded at startup |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | set → export request spans (OTLP/HTTP) |
| `OTEL_SERVICE_NAME` | `shiptivitas-inference` | OTLP `service.name` |
| `DEPLOYMENT_ENVIRONMENT` | `development` | OTLP resource attribute |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | `{ status, model: <version> }` |
| `POST` | `/triage` | `{ tasks: [{ id, status, priority, mode, etaAt }] }` → `{ suggestions: [...] }` |

The `/triage` contract matches the backend's, so the frontend points
`VITE_TRIAGE_URL` here (it POSTs to `${VITE_TRIAGE_URL}/triage`).

## Model & training

Six features per task — `nearness` (ETA proximity), `critical`, `air`, and a
one-hot of the current status — feed per-class logits → softmax → argmax.

```bash
npm run train          # writes learned weights + metrics to model.json
```

`scripts/train.ts` builds a seeded synthetic dataset labelled by domain rules with
~8% label noise, trains the softmax model by gradient descent (reusing the
service's own feature extraction — no train/serve skew), and writes `model.json`
with `version`, `trainedAt`, and validation `metrics` (current artifact: ~0.94
accuracy). Swap `model.json` to ship new weights with no code change.

## Tests

```bash
npm test     # vitest: model behaviour (scorer), /triage route, OTLP exporter
```
