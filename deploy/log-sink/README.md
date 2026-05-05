# Log Sink Configs (Phase 37-04)

Templates for shipping CustomReport API logs to a remote observability backend.
Choose one of the two sidecar options below depending on your stack.

## Source

`AppLogger` (`apps/api/src/lib/logger.ts`) writes structured JSON logs to
`${LOG_DIR}/app.log` with rotation (10 MB max, 5 files kept, gzip archive,
30-day retention). In `docker-compose.prod.yml`, this lives in the
`apilogs` named volume mounted at `/app/logs`.

Each log line is a single JSON object with at minimum:

```json
{
  "timestamp": "2026-05-06T00:12:34.567Z",
  "level": "info|warn|error|debug",
  "message": "human-readable summary",
  "service": "customreport-api",
  "correlationId": "uuid-from-cls",
  "phase": "http.request|trpc.request|audit|...",
  "userId": "uuid-or-null",
  ...domain-specific fields...
}
```

## Option A — vector.dev (recommended)

`vector.toml` is the default template. Uncomment one of the sinks (Loki /
Datadog / Elasticsearch) and set its credentials via env. Console sink
stays on for sanity-checking the pipeline locally.

```bash
docker run --rm \
  -v $(pwd)/vector.toml:/etc/vector/vector.toml:ro \
  -v customreport_apilogs:/app/logs:ro \
  -e LOKI_ENDPOINT=https://loki.example.com \
  timberio/vector:0.36.0-alpine
```

## Option B — Promtail (Loki-native)

`promtail.yml` is the alternative if you're already on the Grafana Loki
stack. Promotes `level` + `phase` to labels (kept low-cardinality);
`correlationId`, `userId`, `duration`, `status` stay in the message body
(searchable but not indexed).

```bash
docker run --rm \
  -v $(pwd)/promtail.yml:/etc/promtail/config.yml:ro \
  -v customreport_apilogs:/app/logs:ro \
  -e LOKI_ENDPOINT=https://loki.example.com/loki/api/v1/push \
  grafana/promtail:2.9.0 \
  -config.file=/etc/promtail/config.yml
```

## Wiring into compose

To run vector as a sidecar alongside the api in production:

```yaml
# Add to docker-compose.prod.yml:
services:
  log-shipper:
    image: timberio/vector:0.36.0-alpine
    volumes:
      - ./deploy/log-sink/vector.toml:/etc/vector/vector.toml:ro
      - apilogs:/app/logs:ro
    environment:
      LOKI_ENDPOINT: ${LOKI_ENDPOINT}
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped
```

## Verify the pipeline

After bringing up the sidecar:

1. Tail the local log: `docker compose exec api tail -f /app/logs/app.log`
2. Generate a few requests: `curl -fsSL https://your-host/health/ready`
3. Confirm the same lines appear in your remote sink (Loki UI / Datadog Logs / etc.)
4. Search by `correlationId` to verify field promotion worked.
