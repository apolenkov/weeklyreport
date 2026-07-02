## Context

`LeadVelocityChart` and `TrafficLightHistoryChart` both build a per-period data
array where each entity (lead or project) contributes one column. The column key
is currently the entity's display name. recharts reads a `Bar` or `Line` by
looking up its `dataKey` in each data point object; when two entities share a
name, both elements point at the same column and the second write wins, silently
zeroing the first entity's contribution.

The fix is mechanical: use the stable UUID as the data column key and pass the
human-readable name through recharts' `name` prop. recharts renders tooltip
labels (and legend entries where a legend is present — `LeadVelocityChart` has
one, `TrafficLightHistoryChart` does not) from `name`, so users see unchanged
display text while each series is individually addressable.

The shared schemas already expose `leadId` and `projectId` in every row, so no
API or Prisma change is needed.

## Goals / Non-Goals

**Goals:**

- Eliminate silent data loss when two leads or two projects share a display
  name in either analytics chart.
- Preserve human-readable labels in recharts legend and tooltip.
- Add a regression test that fails against the pre-fix code (duplicate-name
  fixture with two distinct value assertions).

**Non-Goals:**

- `PeriodComparisonChart` — it renders one row per project directly without a
  name-keyed pivot, so it is not affected by this class of bug and is out of
  scope.
- Renaming or deduplicating leads/projects at the data level.
- Adding new chart types or analytics endpoints.

## Decisions

### Key entities by UUID in the data array; expose name through the `name` prop

recharts `Bar`/`Line` uses `dataKey` to select values and `name` as the display
label. Setting `dataKey={leadId}` and `name={leadName}` on each `Bar` is the
idiomatic recharts pattern for stable series identity — it is how the library
separates "which column holds my data" from "what text do I show". This is
preferable to pre-deduplicating names in the data layer because it is local to
the chart component and requires no shared-schema change.

**Alternative considered:** suffix duplicate names at the chart layer (e.g.
"Alice (2)"). Rejected — it changes user-visible text based on peer entities,
which is confusing and fragile.

### Extract a pure data-and-series builder so the regression is testable

Each chart's pivot logic moves into a pure exported function returning
`{ data, series }`, where `series` is an array of `{ dataKey, name }`
descriptors. The component renders `Bar`/`Line` by mapping over `series`. This
makes the duplicate-name fix directly unit-testable on plain objects.

recharts 3.x renders inside a `ResponsiveContainer` that reports zero width in
jsdom, so `Bar`/`Line` are not emitted as stable DOM nodes and their `dataKey` /
`name` are React props, not DOM attributes — asserting them on the rendered tree
is brittle and effectively unimplementable. Testing the builder output instead
asserts UUID `dataKey`s, independent values, and the `name` per series
deterministically. The existing crash-free-mount render tests stay.

### Keep the x-axis `"period"` key as a literal

UUID keys for entity columns cannot collide with `"period"` (a UUID is a
32-hex-digit string with dashes; `"period"` is a plain word). No defensive
check is needed, but the spec makes this explicit so a future reader does not
second-guess the presence of two key types in the same object.

## Risks / Trade-offs

- recharts `name` prop is supported on `Bar` and `Line` in recharts 2.x / 3.x
  (current project dependency). If recharts is upgraded to a hypothetical major
  that renames the prop, legend/tooltip labels would silently regress.
  Mitigation: the regression test asserts the `name` on each series descriptor
  returned by the chart's data builder rather than visual output, providing an
  early signal at the data layer.
- UUID values as column keys make the raw data object less readable during
  debugging.
  Mitigation: this is a dev-time concern only; `leadNameById` / `row.projectName`
  remain available via the maps already built in the components.
