# Handoff — viewer "status observer" pivot + live-review follow-ups (2026-06-25)

Picks up a live-review session. The **name-display policy is DONE, archived, and
pushed** (`main` @ 9cd75a8 + the archive commit); this doc is the REMAINING work,
to be started fresh. The headline item reverses just-archived behavior, so grill
it like the names were grilled — do NOT silently rebuild.

## Start here

The user confirmed (2026-06-25): **the viewer is a status observer, not just a
consumer of published reports.** A viewer should see the LATEST period in ANY
state — draft / submitted / live — not only `published`. This **reverses
change B** (archived `2026-06-24-viewer-report-surface-parity`):

- `viewer-published-search`, `viewer-report-navigation`, and the published-only
  read gate (`head-report-visibility`) all assume viewer = published-only.
- `/reports/latest` resolves `reports.latestPublished` (gates on
  `periodStatus='published'`) — `trpc.router.ts:559`.
- The viewer report read 404s a non-published period (verified live last session:
  the open period showed "Report not found").

Recommended: a NEW grilled OpenSpec change (e.g. `viewer-live-status`) that
explicitly supersedes the relevant change-B requirements (MODIFIED/REMOVED), not
a silent edit. Reconcile against the archived specs.

## The review items (priority order, user sequenced names FIRST = done)

1. **Viewer sees the latest period's status, any state** (the pivot). Replace the
   "Latest" entry (latest _published_) with a "Status" entry (latest _period_,
   whatever its state). The viewer should see "0/3 submitted", draft sections,
   live state — the current status — not an empty/404.
2. **Bug that exposed it:** a lead submitted (as Vasily) and the viewer saw
   nothing. Direct consequence of published-only: submitted ≠ published. The
   pivot fixes this.
3. **"Latest" → "Status" rename/rethink** in the viewer nav (`nav-bar.tsx`).
4. **Nav "Latest" never highlights active** (`nav-bar.tsx` `isActiveLink`,
   ~:120): `/reports/latest` redirects away, so its href never matches the
   pathname; `/reports/[id]` then matches "History" via startsWith. Likely moot
   once Latest→Status, but note it.
5. **Viewer toolbar affordances** (`viewer-report-shell.tsx`): the user
   questioned "Back to Archive" (:150) and "Agent review" (`AgentReviewComingSoon`,
   :168) for a read-only reviewer — confirm whether they belong.
6. **Period-creation lock** (separate logic, NOT viewer): a new period must not be
   creatable while the current one is still open/unclosed; today it "locks and
   creates". Decide the rule + where to enforce. Entry points to investigate:
   `weekly-report.prisma-repository.ts`, `publication.prisma-repository.ts`,
   `trpc.router.ts`.

## Key grill questions for the pivot (design decisions, get the user's answers)

- In a draft/live period, WHOSE content does the viewer see — all sections of the
  latest period, group-scoped, or only submitted ones? Read-only still?
- Does `publish` still mean anything for the viewer, or is it purely a
  head/archival concept now?
- Does viewer SEARCH go live too (not just published), mirroring the read?
- What replaces the `/reports/latest` = latestPublished resolution — "latest
  period the viewer can see, any status"? New `reports.latestForViewer`?
- Does the viewer still get an Archive/History of past published reports?

## Environment caveats (carried from this session)

- The running docker `web` container serves a STALE build — the name-format fix is
  NOT visible there until `web` is rebuilt or `pnpm --filter @customreport/web
dev` is run. A parallel session was using the shared runtime + dev DB this
  session; do NOT reseed or restart their containers without checking.
- Shared tree: stage only your paths (parallel session holds untracked
  `.shot*.png` + a dashboard ADR). Commit/push to `main` is MVP-pre-authorized.
- `rtk vitest` mis-parses TSX → `cd apps/web && pnpm exec vitest`. Integration
  tests run serial (`--config vitest.integration.config.ts --fileParallelism=false`).
  `npx prisma generate` before gates. Dev DB user is `customreport`.

## Done this session (for context, no action needed)

- Name-display policy: ADR 0006, CONTEXT glossary, archived change
  `user-name-display-policy`, spec `user-name-display`. `shortNameFromName` shared
  helper. Full ФИО → own top badge only; short form everywhere spelled out;
  two-letter for avatars + micro-chips; `getCrossAuthors.authorShortName` added.
- Earlier: the `fillFrom` source-auth fix + the A/B verify+archive are all on
  `main` too (see `session-wrap-2026-06-25-FINAL.md`).
