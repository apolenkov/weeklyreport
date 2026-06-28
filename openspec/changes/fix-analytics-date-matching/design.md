## Context

The analytics repository serves three read paths over published `Report` rows:
`trafficLightHistory`, `leadVelocity`, and `periodComparison`
(`apps/api/src/modules/analytics/analytics.prisma-repository.ts`). All three
key periods by a date-only label produced by `isoDateOnly(d)` =
`d.toISOString().slice(0, 10)` (UTC, timezone-stable). The shared input/output
schemas live in `packages/shared/src/schemas/analytics.ts`.

`Report.periodEnd` is a Prisma `DateTime` (full timestamp), but analytics input
arrives as a date-only `YYYY-MM-DD` string. The three bugs all stem from that
type mismatch plus naive matching.

## Goals / Non-Goals

Goals:

- Match a date-only label against a full-timestamp `periodEnd` correctly.
- Reject impossible calendar dates at the schema edge.
- Stop dropping reports when several map to the same label.

Non-Goals:

- Group scoping of analytics reads — owned by `scope-analytics-to-group`
  (P0-5). This change must not collide with its edits to the same repository;
  the two are coordinated at apply time but specified independently.
- Changing how `periodStart`/`periodEnd`/`deadline` are stored or parsed at
  write time — owned by `fix-period-datetime-tz` (#24).
- Caching changes — the cache key already hashes the parsed input; a stricter
  `isoDateOnly` only narrows the accepted key space.

## Decision 1: UTC day-range helper, reused across the file

Add a small UTC day-range helper alongside the existing `isoDateOnly`:

- `startOfUtcDay(dateOnly: string): Date` → `new Date(`${dateOnly}T00:00:00.000Z`)`.
- `nextUtcDay(dateOnly: string): Date` → start of the following day.

`periodComparison.fetchOne` changes from
`where: { ...PUBLISHED_FLOOR, periodEnd: new Date(periodEnd) }`
to
`where: { ...PUBLISHED_FLOOR, periodEnd: { gte: startOfUtcDay(date), lt: nextUtcDay(date) } }`.

`trafficLightHistory` already uses `periodStart: { gte }` / `periodEnd: { lte }`.
The `lte: new Date(periodTo)` upper bound today resolves to midnight UTC of
`periodTo`, excluding reports whose `periodEnd` falls later that same day. Switch
the upper bound to `lt: nextUtcDay(periodTo)` so the final day is inclusive. Apply
the same `lt: nextUtcDay(periodTo)` correction to `leadVelocity` for parity.

Rationale: a half-open `[start, nextDay)` range is the standard, DST-free way to
match a calendar day against a timestamp column, and it stays consistent with the
UTC label function already in the file.

## Decision 2: real-date refine on `isoDateOnly`

Keep the format regex as the cheap first gate, then refine:

```ts
const isoDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) => new Date(`${s}T00:00:00.000Z`).toISOString().slice(0, 10) === s,
    {
      message: "Not a real calendar date",
    },
  );
```

The round-trip check rejects `2026-02-30` (rolls to `03-02`), `2026-13-45`
(`Invalid Date` → `toISOString` throws / mismatches), and any other impossible
value, while the UTC parse keeps it timezone-stable. `2026-13-45` makes
`new Date` return `Invalid Date`; guard the `toISOString()` call (wrap in a
`Number.isNaN(d.getTime())` check) so the refine returns `false` instead of
throwing.

Because every analytics field aliases `isoDateOnly`, one edit covers
`periodFrom`, `periodTo`, `periodA`, `periodB`, and the output label fields.

## Decision 3: aggregate per label, with a deterministic tie-break

`trafficLightHistory`: replace the per-cell `reports.find(...)` with a
pre-built `Map<label, Report[]>`. For a `(label, projectId)` cell, scan all
reports under that label and choose the status via a documented tie-break:
report with the latest `periodEnd`, then latest `createdAt`. This keeps the
output stable when two reports share a label and both carry the project.

`periodComparison`: `fetchOne` becomes `fetchAll` returning every report under
the side's day range. The existing `collect(report)` accumulator already sums
risks via `existing.risks + 1`; run it across all reports for the side so risk
counts sum and statuses follow the same latest-report tie-break.

Rationale: the data model permits multiple `Report` rows under one `periodEnd`
date (the partial unique index only guards `periodState = 'open'`; published and
archived rows are unconstrained), so "first match wins" is a silent data-loss
bug. A latest-timestamp tie-break is deterministic and matches the intuition
that the most recent republished period is authoritative for a status, while
risks are additive across the contributing reports.

## Risks / Trade-offs

- **Overlap with `scope-analytics-to-group`.** Both edit the same repository
  methods. Mitigation: this change touches the WHERE date predicates and the
  per-label aggregation loop; the scope change touches the nested
  `include.sections.where`. Apply order is coordinated; whichever lands second
  rebases onto the first. The specs are independent (no shared requirement).
- **Tie-break choice is a product call.** "Latest report wins for status, risks
  sum" is documented here; if a stakeholder later wants a different rule, it is a
  one-line change isolated to the aggregation helper.
- **Stricter input validation could reject a client that previously sent a junk
  date.** That client was already getting wrong/empty results; a 400 at the edge
  is the correct, louder failure.

## Migration Plan

No DB migration. Schema (Zod) and repository query-shape change only. Existing
analytics cache entries remain valid; the stricter `isoDateOnly` only narrows
which inputs can produce a key.
