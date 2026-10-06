# Proposal

## Why

Leads write a lot of text and move planned work between weeks, but the Lead Report Overview makes that slow: every item carries permanent text buttons, a metadata line and nested dialogs, prior-week work has no single verdict, and the page needs about 70 interactive controls and ~4000 px (1280 px) or ~7500 px (375 px) before submit. The owner asked for the simplest possible form that does the obvious thing by default and reveals detail on demand (backlog TASK-346, decision-138, audit and arena in `~/.local/state/session-review/weeklyreport-20260929/lead-form-20261006/`).

## What Changes

- Each item in the Overview rests as one status icon and its text; actions appear on hover, keyboard focus or tap instead of permanent text buttons, and the metadata line is replaced by a small stage badge. SDLC stages and other detail are edited only inside the canonical item editor.
- Prior-week planned items get one verdict in one action — done, continue (Current), next week, paused (with a one-line reason); won't do stays in the overflow menu. The prior week is never edited: the verdict is written as the item's Current/Next occurrence by `stableId`.
- A lead can confirm all suggested continuations at once ("Confirm all as continue").
- Submit stays blocked by the existing unconfirmed-carried-item rule; its wording becomes a review counter shown on the existing sticky Save/Submit cluster. The end-of-form explanation stays.
- The report health block becomes a one-line summary that expands on demand; the earlier-open-work register is collapsed into one disclosure line by default.
- Project Activity weekly title/description fields move behind an explicit edit control.
- **BREAKING (UI contract only):** permanent `Update progress` / `More actions` / `Plan this work` buttons and the Previously planned "no mutation control" rule are replaced; e2e and unit tests that drive those controls must follow.

## Capabilities

### New Capabilities

- `lead-plan-verdict`: the verdict vocabulary for prior-week planned items, how a verdict becomes a Current/Next occurrence without changing the prior week, bulk confirmation and review counting.

### Modified Capabilities

- `lead-status-overview`: item rest state and reveal-on-demand actions; Previously planned verdict controls; collapsed earlier open work.
- `lead-completion-guidance`: review counter on the sticky action cluster.
- `lead-report-health-pulse`: one-line default summary.
- `weekly-activity-presentation`: weekly title and description fields opened on demand.

## Impact

- Web: `apps/web/src/features/report-sections/ui/status-overview*.tsx`, `features/report-pages/ui/lead/shell/open-work-register.tsx`, lead report health block, lead activities weekly fields, sticky action cluster.
- API: no new procedure and no schema migration; reuses the existing item save path and the existing prior-plan outcome command; submit validation reuses the unconfirmed-carried-item blocker.
- Tests: `e2e/lead-form/overview.test.ts`, `completion.test.ts`, navigation and lifecycle suites; `lead-status-overview.test.tsx`, `status-overview-item-preview.test.tsx`, `lead-submit-readiness-summary.test.tsx`.
- Invariants preserved: previous period read-only, weekly-cycle rollover, period dual-state, canonical `leadProcedure`.
