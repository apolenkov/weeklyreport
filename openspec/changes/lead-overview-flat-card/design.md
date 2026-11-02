## Context

Sources: owner request `~/work/handoffs/task-825/owner-request-card-ux-2026-11-02.md`, pattern research
`research-inline-editing.md`, and three skill proposals (`design-frontend-design.md`, `design-web-guidelines.md`,
`design-ui-ux-pro-max.md`) in the same handoff directory. All three agree on: no drag, no overflow, flat
hover row in reserved space, status menu carries outcomes, dialog creation, one Add per unit, colour carries
one meaning per layer.

## Decisions

1. **Card grid.** `[status slot 32px] [content 1fr] [actions auto]`. The status glyph (20px) centres on
   the first text line. Stage badges sit under the text. The actions column is reserved on hover devices
   (`md+`, `hover:hover`), shown by opacity on `group-hover`, `group-focus-within` and an open control;
   without hover it wraps to its own row and is always visible. No absolute floating chip, no `::before` bridge.
2. **Actions row** (icon buttons, ≥24px, touch `--touch-target-min`): Edit (pencil → dialog), week move
   (→ Next / ← This week, same contract and Undo as today; Alt+Arrow kept), Stage (Product only; popover with
   `menuitemcheckbox` of owned stages, stays open, each toggle is one draft patch), Plan / Restore where
   recovery applies.
3. **Status menu** keeps its statuses and risk/lock reasons and gains the outcome entry (the old
   "Update status" overflow item) at its end, separated. One level.
4. **Dialog editor.** The existing `OverviewEditorDialog` content renders inside the shared `Dialog`
   (packages/ui) instead of the timeline editor slot; create and edit both. Focus rules for create save
   (focus the new item) stay; edit returns focus to the trigger.
5. **Creation entry.** Only the unit header `Add item to <unit>`; the dialog's existing week radios pick
   Current/Next. Cell and row `+` and the mobile per-week header controls go.
6. **Text click** keeps the existing in-place text editor (same font, no height change). If browser checks
   show a jump, it moves into the dialog as well.
7. **Colour and sections** (existing tokens only):
   - focus: 2px solid `--color-primary` outline on `focus-visible` for card controls (ring at .3 alpha is ~1.6:1);
   - card hover: border `--color-border-accent-hover` instead of the near-invisible surface tint;
   - unit group headers (Products / Project activities): 4px left bar, `--color-primary` / `--color-toggle-active`;
   - column headers: Previous muted, Current solid `--color-primary` underline, Next dashed `--color-primary`.
8. **Removed code**: `status-overview-item-overflow.tsx` (folded: Plan/Restore move to the row),
   floating parts of `status-overview-item-chip.tsx`, `status-overview-dnd.tsx` and its model and the lane
   droppable, `CellCreateButton` / per-week mobile create controls, the in-grid editor slot rendering.
   `@dnd-kit/core` leaves `apps/web/package.json` if nothing else imports it.

## independent review (GO with changes, applied)

Outcome entry keeps `overflowHandlers` eligibility; stage writes go through the current draft and refuse the
last Product stage; DnD removal keeps `moveItem`/`moveWithoutEditor`, placement-or-acknowledgement and Undo;
dialog dismissal (Escape, close, outside click) runs the Cancel/discard path and one focus mechanism
(`useOverviewFocusReturn`) wins over the dialog's own autofocus return; the existing comment action stays in
the row; the overflow ban covers Current/Next only (Previous verdict rail keeps Won't do). Slices: (a) DnD,
flat row, outcome entry, cell `+`, colour; (b) editor into dialog with recovery, all close paths, batch create,
focus; (c) stage control. Check also the intermediate three-column width and long text.

## Not in this change

Remove-item from the card, a Next-step chip (separate decision), paused-reason panel inside the status popover (the existing reason flow stays), Previous verdict
rail, Risks/Decisions section restyle outside the Overview grid.

## Risks

- Layout shift on hover/open: verified by `getBoundingClientRect` before/after in agent-browser (0px).
- Focus loss after week move / dialog close: existing `data-overview-focus` keys, browser keyboard pass.
- Hover-only: `hover:none` emulation at 375 shows the row; targets measured.
- Losing the in-grid editor breaks tests and e2e that look for the editor inside the unit region; they move
  to the dialog role.
- Contrast numbers are estimates until measured in the browser.
