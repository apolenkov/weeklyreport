# Console-error baseline (wave 35 drive)

Every route loads with a fixed set of DEV-ONLY telemetry errors that are NOT
bugs — the triage MUST filter these before flagging anything:

- `http://localhost:8000/api/1/envelope/...` — Sentry ingest, not running locally.
- `http://localhost:4747/sessions`, `/health` — Agentation MCP sidecar, not running.

Filter rule: `grep -vE 'localhost:8000|localhost:4747|sentry|Agentation'`.
A route is "clean" when nothing survives that filter. All 4 roles' primary
screens (lead form, head dashboard, admin users, viewer published snapshot)
were clean under this filter on 2026-07-15.
