# Phase 37, Plan 04 — SUMMARY

**REQ-IDs:** OBS-04
**Status:** complete

## What shipped

- `deploy/log-sink/vector.toml` — vector 0.36 config: file source on /app/logs/app.log, JSON-parse transform, three commented sinks (Loki / Datadog / Elasticsearch) + a default console sink for pipeline sanity.
- `deploy/log-sink/promtail.yml` — Promtail 2.9 config for the Loki-native path. Promotes `level` + `phase` to Loki labels (low-cardinality), keeps `correlationId` / `userId` / `duration` / `status` in the message body (searchable, not indexed).
- `deploy/log-sink/README.md` — choose-your-shipper guide + sidecar compose snippet + verification steps (`tail -f` + curl + remote-sink search by correlationId).

## Files

- `deploy/log-sink/vector.toml` (new)
- `deploy/log-sink/promtail.yml` (new)
- `deploy/log-sink/README.md` (new)
