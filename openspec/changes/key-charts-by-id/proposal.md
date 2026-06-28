## Why

`LeadVelocityChart` keys its recharts data points and `Bar` `dataKey` by lead
display name; `TrafficLightHistoryChart` does the same with project name.
Display names are not unique — two leads (or projects) that share a name
produce two identically-keyed columns, causing the second entity's data to
silently overwrite the first. The affected chart renders two series that look
distinct but carry only one entity's values; the other entity's contribution
disappears. This is a data-integrity defect: the head is shown a misleading
picture whenever the org has name collisions.

## What Changes

- `apps/web/src/components/charts/lead-velocity.chart.tsx`: key the per-period
  data point and each `Bar` `dataKey` by `leadId` (UUID) instead of
  `leadName`; pass `name={leadName}` on each `Bar` so legend and tooltip still
  show the human-readable name.
- `apps/web/src/components/charts/traffic-light-history.chart.tsx`: key the
  per-period data point by `projectId` (UUID) instead of `projectName`; pass
  `name={row.projectName}` on each `Line` so legend and tooltip still show the
  project name.
- `apps/web/src/components/charts/charts.test.tsx`: add regression scenarios
  that assert both entities' values survive when two entities share a display
  name.

No backend, schema, or API changes — `leadId`/`projectId` are already present
in the shared `LeadVelocityOutput` and `TrafficLightHistoryOutput` types.

## Capabilities

### New Capabilities

- `analytics-chart-series-identity`: recharts data-series in analytics charts
  are keyed by stable entity id so duplicate display names do not collide; the
  display name is preserved in legend and tooltip via the recharts `name` prop.

### Modified Capabilities

_(none — no existing spec governs this behavior)_

## Impact

- **Changed files**: `lead-velocity.chart.tsx`, `traffic-light-history.chart.tsx`,
  `charts.test.tsx` — all in `apps/web/src/components/charts/`.
- **No breaking API changes**: the shared schemas (`LeadVelocityOutput`,
  `TrafficLightHistoryOutput`) are unchanged; `leadId`/`projectId` are already
  part of the contract.
- **No database, migration, or server changes**.
- **Test gap closed**: current tests render only single-entity fixtures and
  assert crash-free mount; they do not catch the duplicate-name data loss.
