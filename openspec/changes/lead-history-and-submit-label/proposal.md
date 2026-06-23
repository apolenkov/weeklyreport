# Lead history clarity + "Submit" label

## Problem

Live demo feedback (2026-06-23) on two lead surfaces:

1. **`/lead/report/...` — the commit button reads "Submit Section".**
   The owner asks "почему Submit Section, а не просто Submit?". On the
   lead page a lead only ever sees their own section, so "Section" adds
   no information — it is system vocabulary leaking into the button.

2. **`/reports` history list — order is not newest-first.**
   The owner asks to reverse it so the latest period is on top. Root
   cause: `reports.myHistory` orders sections by `section.createdAt
desc`, but `createdAt` is the row's insertion time (seeds set it in
   one run), unrelated to the reporting-period chronology. The sibling
   `reports.compiledHistory` already orders by `report.periodStart
desc`; only the lead's personal history diverges.

3. **`/reports` summary rail — "6 0 0 across 3 periods".**
   The owner asks why only submitted is counted and whether the draft
   should show. The traffic-light totals count only _completed_
   periods (submitted/published/archived) — correct, a draft is
   provisional — but the footer's denominator still says "across **3**
   periods" (the full count), so the numerator and denominator
   disagree. A "1 draft not included in aggregates" note already
   discloses the draft.

While tracing item 2/3, a fourth, latent issue surfaced:

4. **`?tab=drafts` is a dead URL parameter.** `/lead/history`
   307-redirects to `/reports?tab=drafts` and `/head/history` to
   `/reports?tab=published`, both promising a pre-selected tab, and
   `reports/page.tsx` carries a comment about "role-default tabs". But
   the page never implemented tabs — it ignores `tab` and renders the
   single role-defaulted history. The dead param and stale promise
   likely coloured the owner's reading of items 2 and 3 (they believed
   they were on a "My Drafts" view).

## Decisions (grilled 2026-06-23)

1. **Label → "Submit".** Lead POV beats system vocabulary; the
   confirmation dialog keeps the fuller wording.
2. **Order by reporting-period chronology (`periodStart desc`)**, not
   section `createdAt`. The summary rail's "streak" loop already assumes
   newest-period-first, so it must read the same key — fixing the order
   also fixes a subtly wrong streak.
3. **Aggregates stay submitted-only** (a track record of finished work);
   a draft is excluded and disclosed.
4. **Footer denominator = the count of aggregated (completed) periods**,
   so numerator and denominator agree; the existing draft note explains
   the gap.
5. **Drop the dead `tab` param.** `/reports` is one unified
   role-defaulted history; clean the redirects and the stale comment.

## What changes

1. **Submit label** (`lead-form.tsx`): the lead's forward commit button
   reads **"Submit"** (was "Submit Section"); the submit confirmation
   dialog keeps explanatory wording but its primary action also reads
   "Submit".
2. **History order** (`apps/api` `reports.myHistory`): order by the
   related report's `periodStart` descending (with a stable secondary
   tiebreak), matching `compiledHistory`.
3. **Summary footer** (`lead-history-sidebar.tsx`): the traffic-light
   footer's denominator counts the completed periods it actually
   aggregates, not the full total; the "N draft not included" note
   stays.
4. **Dead tab cleanup**: `/lead/history` and `/head/history` redirect to
   `/reports` (no `tab` param); remove the "role-default tabs" comment
   from `reports/page.tsx`.

## Impact

- Affected specs:
  - `lead-history-summary` (NEW) — ordering + aggregate semantics + no
    tab state.
  - `lead-toolbar-presentation` (ADD one requirement) — the lead commit
    control is labeled "Submit".
- Affected code:
  - `apps/web/src/components/lead/lead-form.tsx` (button + confirm
    dialog + comment)
  - `apps/web/src/components/report-shell/report-toolbar.tsx` (comment)
  - `apps/api/src/infrastructure/trpc/trpc.router.ts`
    (`reports.myHistory` orderBy)
  - `apps/web/src/components/lead/lead-history-sidebar.tsx` (footer
    denominator)
  - `apps/web/src/app/(app)/lead/history/page.tsx`,
    `apps/web/src/app/(app)/head/history/page.tsx` (redirect targets)
  - `apps/web/src/app/(app)/reports/page.tsx` (stale comment)
  - tests: lead-form / report-toolbar / lead-history-sidebar suites that
    assert "Submit Section" or history order/footer copy.
- Other specs (`report-toolbar-layout`, `toolbar-polish`,
  `report-toolbar-parity`, `head-toolbar-semantics`) mention "Submit
  Section" only as the control's descriptive name, not as a normative
  label; the new requirement is the normative source for the label and
  supersedes those incidental mentions.
- UI strings stay English. No schema or data changes.

## Existing-spec coherence (`archive-history-ia`)

`archive-history-ia` reserves "History" for within-report version
snapshots and "Archive" for past closed reports, and requires the two to
stay distinct. That does NOT conflict with this change, but two
clarifications are recorded so a future reader is not misled:

1. **Snapshot-"History" is deferred, not removed.** The version/snapshot
   feature lives in `openspec/deferred/versions-v2-restore-fidelity` and
   is surfaced only as the inert `VersionComingSoonControl`. So the
   distinct snapshot surface `archive-history-ia` protects does not exist
   as a live tab today; this change does not collapse it into anything.
2. **The `/reports` page is the past-reports ("Archive") surface.** This
   change uses "History" in the UI sense — the page is literally titled
   "History" and renders the lead's reports across periods, with an
   archive toggle for closed ones. It does not merge the deferred
   snapshot surface into it.
3. **`archive-history-ia` is stale on its consumer paths.** It names
   `components/weekly-report/report-toolbar.tsx` and
   `components/weekly-report/archive-toggle.tsx`; both have since moved to
   `components/report-shell/`. Reconciling that spec's paths and its
   "History"/"Archive" vocabulary against the shipped single `/reports`
   surface is out of scope here — flagged for a follow-up (best done
   when `versions-v2` is reopened or the stale spec is refreshed).
