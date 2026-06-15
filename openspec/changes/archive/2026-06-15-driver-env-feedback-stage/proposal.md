# Driver Environment-Feedback Stage (DRAFT — capture only)

## Why

An ai-ui-driver run watches only the browser. Four environment channels
already run for free during every drive and are never read: the
Playwright-MCP console logs on disk, the API structured log, Bugsink
(Sentry-compatible error tracker), and Loki inside grafana/otel-lgtm. The
2026-06-10 polish session verified UI changes in the live browser yet looked
at none of these until the user asked — server-side errors triggered by the
drive went unseen (memory: `driver-env-feedback-idea`).

Two wiring gaps make the channels partially blind today:

- The sweep web start command (`e2e/sweep/driver/README.md`) does not pass
  `NEXT_PUBLIC_SENTRY_DSN`, so web errors likely never reach Bugsink during
  driver runs (boundaries `app/error.tsx` / `app/global-error.tsx` need it).
- API→Loki shipping (`otel.bootstrap.ts` `OTLPLogExporter` →
  `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`) activates only when the endpoint
  is set; `.env.example` defaults to `http://otel-lgtm:4318` — a Docker
  hostname the **native** sweep API cannot resolve. Loki had zero streams on
  2026-06-10.

## What Changes

Add a **post-run environment-feedback stage** to the ai-ui-driver skill
(between Phase 2 free exploration and Phase 3 verify):

1. The drive records a **timeline**: run start/end plus per-route enter/exit
   timestamps (ISO) in the per-role report.
2. After driving, a bundled collector sweeps the four channels for the run
   window, correlates hits to routes via the timeline, and appends an
   "Environment feedback" section to `e2e/sweep/.reports/<role>-driver.md`.
   Note: the driver API logs to `apps/api/.logs/driver/app.log` (`LOG_DIR`
   in the README start command), not the default `pnpm logs` target.
3. Each channel gets a **liveness check** (the canary principle extended):
   an unreachable or unwired channel is reported as "blind", never as
   "clean".
4. Environment hits become candidates (`kind: "env"`) that flow into the
   existing Phase 3 verify and Phase 4 packaging.
5. The two wiring gaps above are fixed so the channels actually carry
   signal during sweep runs.

## Non-goals

- No always-on monitoring or CI gating — report-only, like the driver itself.
- No new observability services; only the existing compose stack is read.
- No changes to drive behavior, catalogs, or the verify skeptic logic.
- Production observability is untouched.

## Impact

- `.claude/skills/ai-ui-driver/SKILL.md` + a bundled collector script.
- `e2e/sweep/driver/README.md` and `drive-prompt.md` (timeline + env vars).
- `.env.example` comment for the native-run OTLP endpoint.
- No production code paths; apps/web and apps/api source untouched except
  env wiring documentation.
