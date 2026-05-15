# v8.1 Session Leftovers ADR - 2026-05-14

Status: accepted for repo-local implementation.

Source: Claude/Codex session recovery, Plannotator approved/denied plans, and
user feedback requiring autonomous completion of leftover CustomReport work.

## Decision Boundary

The closure milestone uses mode: **Implement all + ADR first**.

The agent may implement repo-local leftovers without another planning loop when
the behavior is specified below and does not require external secrets, production
destructive operations, or a new runtime role.

The agent must stop or keep the item blocked only for:

- GitHub Actions runner/queue failure outside the repo.
- Missing provider tokens or activation keys for AI/Telegram.
- Production/destructive operations.
- Adding a real `director` role to auth/schema.
- Implementing Phase 40 dark theme/rebrand/background UI beyond research,
  unless the user explicitly reopens that scope.

## Accepted Decisions

| ID        | Decision                                                                                                    | Implementation route                                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `D-6`     | Published/archive views must use a publish-time snapshot, not live draft assembly, after publish/republish. | Add snapshot persistence/read path or the smallest equivalent existing-model extension. Draft edits after publish must not change archived read output until republish. |
| `D-8`     | Periods are date-range based and may start on any day.                                                      | Accept non-Monday start dates, reject end-before-start, keep deadline separate from date range.                                                                         |
| `D-16`    | Priority cards show compact stage chips when scoped to stages.                                              | Use current stage/product color mapping where available; show at most two visible chips plus `+N`; keep accessible text.                                                |
| `D-17`    | Period labels use one format across lead/head/admin/history/report views.                                   | Use `Week NN, MMM D-D, YYYY`; show current state as a separate badge, not embedded option text.                                                                         |
| `D-29`    | Head/admin dashboard needs a per-lead summary table below KPI cards.                                        | Reuse existing dashboard/activity data where possible; rows include lead, period status, counts, submitted/last activity fields where available.                        |
| `D-34`    | Viewer semantics are read-only.                                                                             | Viewer sees published/report/PDF access and empty states, but no reminder, edit, draft, activity, or mutation controls.                                                 |
| `A35`     | Director-facing UAT is modeled through viewer read-only flow in this milestone.                             | Add UAT/regression coverage for viewer/director-facing read-only access; do not add a `director` role.                                                                  |
| `UFB-014` | `stageIds` remains the canonical multi-stage field.                                                         | Verify items/risks/decisions/priorities create/edit round trips; add code only where implementation evidence is missing.                                                |
| `UFB-032` | Phase 40 background/rebrand remains research-only.                                                          | Do not implement background UI in v8.1 closure unless user explicitly reopens it.                                                                                       |

## Verification

- Planning docs: `pnpm lint:md`.
- Code changes: targeted unit/component tests for touched modules.
- UI flows: Playwright regression specs for D/UFB/A coverage where practical.
- Milestone closeout: GSD audit before merge/tag.
