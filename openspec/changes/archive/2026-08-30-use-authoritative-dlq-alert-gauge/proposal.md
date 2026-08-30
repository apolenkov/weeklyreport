## Why

The DLQ alert can go silent after an API restart even while failed jobs remain, because it thresholds the process-local `cr_dlq_failed_total` counter instead of the authoritative current-count gauge. The mismatch is visible in `deploy/alert-rules.yml`, `apps/api/src/infrastructure/bullmq/dlq-monitor.service.ts`, and the existing `queue-reliability-monitoring` durable spec.

## What Changes

- Make `DLQFailuresActive` threshold `cr_dlq_failed_current`.
- Add a repository gate that prevents the alert from regressing to the event counter while preserving the five-minute hold.
- Clarify the durable requirement that active-DLQ alerting uses the authoritative gauge.

### Non-goals

- Changing the event counter or Grafana historical panels.
- Changing DLQ retention, retry, or queue-processing behavior.
- Adding a new metric or alerting stack.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `queue-reliability-monitoring`: Require the active failed-job alert to use the restart-safe authoritative gauge.

## Impact

- `deploy/alert-rules.yml`
- `scripts/gates/operations/operations-config-docs.test.ts`
- `openspec/specs/queue-reliability-monitoring/spec.md`
- No API, data-model, or dependency change.
