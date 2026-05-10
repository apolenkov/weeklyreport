# Phase 51: Period Model Expansion + Admin Periods Tab redesign

**Gathered:** 2026-05-10 (in-chat brainstorm about period lifecycle)
**Status:** Ready for planning
**Mode:** Three plans — schema (51-A), UI redesign (51-B), state-machine (51-C). Best as **sequential**: 51-A → 51-C → 51-B.
**Driver:** current Period model is rigid (hardcoded Mon-start Sun-end with Fri deadline). Real orgs want different work weeks, cadences, deadline times. Plus Admin → Periods tab today is a flat list — needs lifecycle-aware actions.

<domain>
## Phase Boundary

**51-A — New AppSettings + Report fields:**

New fields on AppSettings (extends Phase 48-B + 50):

| field                         | type                           | default | drives                                            |
| ----------------------------- | ------------------------------ | ------- | ------------------------------------------------- |
| `firstDayOfWeek`              | enum (`monday` \| `sunday`)    | monday  | period start day; week label rendering            |
| `deadlineDayOfWeek`           | enum (1..7, ISO Mon..Sun)      | 5 (Fri) | replaces «days from start» indirection            |
| `deadlineTime`                | string `HH:MM`                 | `18:00` | deadline hour-minute, in defaultTimezone          |
| `periodCadence`               | enum (`weekly` \| `bi-weekly`) | weekly  | how often new periods spawn                       |
| `maxOpenPeriods`              | int (1..4)                     | 1       | how many overlapping open periods allowed         |
| `requireAllSectionsToPublish` | bool                           | true    | hard vs soft publish                              |
| `allowReopenAfterPublish`     | bool                           | true    | can published periods be reopened                 |
| `reopenWindowHours`           | int (0..168)                   | 48      | only valid for `reopen` action within this window |

Plus new column on `Report`:

- `autoPublished: Boolean @default(false)` — set by 50-B AutoPublisher
- `autoArchived: Boolean @default(false)` — set by 50-B AutoArchiver
- (`archived` already added in 50-B)

**51-B — Admin Periods tab redesign:**

Layout:

```
┌─ Active periods ────────────────────────────────────────────┐
│ │ Period           │ Status   │ Submitted │ Deadline    │ ⋮ │
│ │ 11–17 May        │ open     │ 3/6 ⚠     │ 15 May 18:00│⋮ │
│ │ 18–24 May        │ scheduled│ 0/6       │ 22 May 18:00│⋮ │
└────────────────────────────────────────────────────────────┘

┌─ Archive ─────── [show archived ☐] ───────────────────────┐
│ │ 4–10 May        │ published│ 6/6 ✓     │ 8 May 18:00 │⋮ │
│ │ 27 Apr–3 May    │ published│ 5/6 ⚠     │ 1 May 18:00 │⋮ │
└────────────────────────────────────────────────────────────┘

[+ Create period manually] (disabled when autoCreatePeriods=true)
```

Per-row actions menu (`⋮`):

- `open`: Edit deadline, Publish now, Add note, Delete
- `published`: Reopen (if reopenWindowHours allows), Re-publish PDF, Archive
- `archived`: Unarchive, Permanent delete
- `scheduled`: Edit deadline, Cancel (delete unstarted)

Submission progress badge: `3/6` = green if all submitted, amber if
some late, red if past deadline + missing. Tooltip lists names.

**51-C — Period state-machine:**

```
[scheduled] →periodStart reached→ [open]
[open] →admin publish OR autoPublish→ [published]
[published] →reopen action OR autoArchive→ [open] | [archived]
[archived] →admin unarchive→ [published]
```

Add `Report.periodState` enum column:
`scheduled | open | published | archived`

Migration backfills from current `status` + `periodStatus` + (new
`archived` bool):

- `status=draft, periodStatus=open`, periodStart in future → scheduled
- `status=draft, periodStatus=open`, periodStart in past → open
- `status=published, archived=false` → published
- `archived=true` → archived

After this phase: the old `status` + `periodStatus` columns stay
for backwards compatibility but are derived from `periodState`. Drop
deferred to a future phase.

**Out of scope:**

- `periodCadence: monthly` — adds last-day-of-month edge-case math.
  Stays in deferred until a real user asks.
- Per-Department settings override (multi-tenancy v9.0).
- Holiday calendar (skip period during holidays).
- Custom workflow per-org (publish requires manager approval, etc.).

</domain>

<decisions>
## Implementation Decisions

- **`deadlineDayOfWeek` REPLACES `defaultDeadlineDays`** in semantics
  but the OLD field stays in the schema for one release. Migration:
  if `defaultDeadlineDays` was 4 and `firstDayOfWeek=monday`, the
  derived `deadlineDayOfWeek=5` (Friday). Backfill SQL handles it.
- **`maxOpenPeriods=1` is the new default** (more strict than today,
  where there's no limit). Existing data: if N>1 periods are open
  today, leave them; only newly-created periods respect the limit.
- **`allowReopenAfterPublish=true` + `reopenWindowHours=48`** is the
  default reflecting current behavior (no window limit today). New
  default surface a 48h reopen window; admins can extend.
- **State-machine introduced WITHOUT dropping the old columns.** Both
  shapes co-exist for one release; new reads should use `periodState`,
  writes update both. Adapter pattern with a clear deprecation comment.
- **Admin → Periods tab keeps the existing route** (`/admin?tab=periods`)
  — only the body is restructured. No URL break.

</decisions>

<code_context>

## Existing Code Insights

- `apps/web/src/components/admin/periods-tab.tsx` — current Periods
  tab (flat list, minimal actions).
- `apps/api/src/modules/weekly-report/` — Period publish/reopen
  service methods live here.
- `packages/shared/src/schemas/report.ts` — `appSettingsSchema`,
  `reportPeriodSchema`. Both extended in 51-A.
- `prisma/schema.prisma` — AppSettings + Report models extended.

</code_context>

## Verification Targets

After Phase 51:

```bash
# 51-A
docker exec customreport-postgres-1 psql -U customreport -d customreport \
  -c "\d \"AppSettings\"" | grep -cE "firstDayOfWeek|deadlineDayOfWeek|deadlineTime|periodCadence"
# expected: 4+

# 51-B
# open /admin?tab=periods → see Active/Archive split with action menus

# 51-C
docker exec customreport-postgres-1 psql -U customreport -d customreport \
  -c "SELECT periodState, count(*) FROM \"Report\" GROUP BY periodState;"
# expected: all reports have a non-null periodState
```

## Acceptance Gate

Phase 51 closes when:

1. ✓ 8 new AppSettings fields persist + UI editable
2. ✓ Period.create reads `deadlineDayOfWeek` + `deadlineTime` instead
   of `defaultDeadlineDays`
3. ✓ `maxOpenPeriods` enforced on PeriodCreator cron (50-B)
4. ✓ `requireAllSectionsToPublish` enforced in publish service
5. ✓ Reopen action gated by `allowReopenAfterPublish` +
   `reopenWindowHours`
6. ✓ Admin Periods tab shows Active/Archive split with row-actions menu
7. ✓ Submission progress badge per row
8. ✓ `Report.periodState` populated for every row; reads route through
   new column; writes update both old + new
