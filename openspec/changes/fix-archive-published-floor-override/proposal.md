## Why

From the 2026-07-22 mass-review (`~/work/customreport-archive/2026-07-22-mass-review/`),
Opus-confirmed major, group "Archive published-floor override inversion
(visibility)".

`ArchivePrismaRepository` documents `PUBLISHED_FLOOR` (`archive.prisma-repository.ts:28-42`)
as a defense-in-depth guard: the archive surface is "published reports
only", the floor is the single source of truth for that contract, and the
service-layer `ArchiveReadFilter` is allowed to narrow further but "cannot
widen — the repo will never return non-published rows even if a caller
mis-built the filter."

Both call sites spread the caller's filter **after** the floor:

- `listArchiveReports` (`archive.prisma-repository.ts:70`):
  `const where = { ...PUBLISHED_FLOOR, ...filter };`
- `getArchiveReport` (`archive.prisma-repository.ts:173`):
  `where: { id: reportId, ...PUBLISHED_FLOOR, ...filter }`

Object-spread is later-key-wins, so a `filter.status` overrides the
floor's `status: "published"`. A mis-built `filter = { status: "draft" }`
collapses `listArchiveReports`'s where to `{ status: "draft", archived:
true }` and `getArchiveReport`'s to `{ id, status: "draft", archived:
true }` — both return non-published rows, exactly the widening the
comment says is impossible.

This is latent today: the sole producer of `ArchiveReadFilter`,
`buildArchiveReadFilter`, only ever emits `{ status: "published" }` or
`{}`, so no current caller can trigger it. But a defense-in-depth guard
exists precisely to hold when the primary control is later changed or
buggy — and this one silently does not. The fix is a one-line reordering
at both call sites so the floor is spread last and cannot be overridden
by any present or future filter shape.

## What Changes

- `apps/api/src/modules/archive/archive.prisma-repository.ts`:
  `listArchiveReports` (line 70) and `getArchiveReport` (line 173) each
  spread `filter` before `PUBLISHED_FLOOR` instead of after, so the floor
  always wins regardless of filter content.
- No behavior change for any current caller (`buildArchiveReadFilter`
  never emits a `status` that conflicts with the floor) — this closes a
  latent widening path, it does not alter today's query results.
- `openspec/specs/archive-published-floor/spec.md` (new capability): add
  a requirement that the published-only floor MUST take precedence over
  any caller-supplied filter at both archive read call sites, with a
  scenario for a mis-built filter attempting to widen visibility.

Non-goals: no change to `ArchiveReadFilter`'s shape, to
`buildArchiveReadFilter`, to pagination/cursor logic, or to any other
archive query. No change to the `sectionScopeWhere` section-visibility
filter, which is a separate, already-correct mechanism.
