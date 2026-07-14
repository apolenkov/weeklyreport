## Why

Two independent spec-writers for the 2026-07-14 review backlog discovered the
same process defect: the archived change
`openspec/changes/archive/2026-07-13-web-polish-lows` was archived as
accepted while its `tasks.md` has ZERO checked boxes, and at least two of its
requirements are demonstrably unimplemented in live source:

- the `useCursorPagination` `enabled`-merge requirement (now re-opened as
  `cursor-pagination-enabled-merge`), and
- the save-now-button stale-"Saved" clear requirement (now re-opened as
  `lead-form-save-indicator-truth`).

`openspec/specs/` therefore contains requirements that the code does not
satisfy, and checkbox state in archived changes is not a reliable completion
signal. The remaining ~27 tasks of that archive have never been re-verified.

## What Changes

- Every task of the archived `2026-07-13-web-polish-lows` change MUST be
  re-verified against live source (read the code, not the checkbox): each
  task is classified implemented / unimplemented / superseded.
- Every unimplemented-but-specified requirement found MUST either get a
  re-opened change (if still wanted) or a spec correction removing/annotating
  the requirement (if abandoned) — no silent spec-vs-code drift remains.
- The audit's classification table lands in the archive directory as
  `re-audit-2026-07.md` so the trail is durable.

## Claim disposition

| Sub-claim                                         | Disposition                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| web-polish-lows archived with unimplemented tasks | **Confirmed** (two independent findings: BL-30 seam, BL-08b seam) |
| The other ~27 tasks are also unimplemented        | **Open-verification** — that is what this change establishes      |

## Non-goals

- Not implementing any of the unimplemented items inside this change — each
  goes through its own re-opened change (two already exist).
- Not auditing other archived changes — if this audit finds a systemic
  pattern (not just one bad archive), a follow-up decides whether a broader
  sweep pays.

## File manifest

- `openspec/changes/archive/2026-07-13-web-polish-lows/re-audit-2026-07.md` — new audit table.
- `openspec/specs/web-polish-lows/spec.md` — only if abandoned requirements need annotation.

## Verification

- The audit table lists all tasks of the archived change with a per-task verdict and a file:line evidence pointer for each "implemented" verdict.
- `openspec validate --specs --strict` stays green after any spec annotation.

## Sequencing

Independent; may run any time. Its OUTPUTS (re-opened changes, if any) join
the normal wave ordering.
