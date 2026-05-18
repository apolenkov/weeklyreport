---
phase: 70
title: Planning Hygiene
status: passed
milestone: v8.2
completed: 2026-05-18
---

# Phase 70 — Planning Hygiene

## Goal

Archive historical plans, clean binary artefacts, resolve HEAD-CONSOLIDATE-01 and UFB-061, create Phase 43 retroactive SUMMARY.

## Deliverables

### HYG-01 — 7 historical plans archived

Moved from `.planning/plans/` to `.planning/plans/done/`:

- `ethereal-growing-brooks.md` (PRJ-2 v8 hotfix pack)
- `image-1-velvet-pixel.md` (Slides V2 refactor P61b)
- `merry-zooming-blanket.md` (v8.1 sprint plan)
- `retro-done-composed-swan.md` (PRJ-2 UAT v7 consolidation)
- `robust-baking-aurora.md` (Head report+history+slides P61)
- `small-mvp-enumerated-thunder.md` (Boris overlay seed)
- `2026-05-15-report-domain-data-parity-sweep.md` (Domain parity sweep)

Top-level `.planning/plans/` now contains only the current active plan (`pure-mist.md`).

### HYG-02 — Lock-icon todo moved

`.planning/todos/pending/2026-05-18-lock-icon-foreign-section.md` → `.planning/todos/done/`

### HYG-03 — PNG artefacts moved

28 `.png` files + `session-report-20260517-1326.html` from repo root moved to `.planning/ui-reviews/2026-05-17-18/`.
`.gitignore` updated to exclude `.planning/ui-reviews/**/*.{png,jpg,html}`.

### HYG-04 — NEXT-ACTIONS.md refreshed

`.planning/session-retros/NEXT-ACTIONS.md` updated with v8.2 phase list and current timestamps.

### HYG-05 — HEAD-CONSOLIDATE-01 resolved

`apps/web/src/app/(app)/head/slides/page.tsx` replaced with a redirect to `/head/history?mode=slides` (preserves bookmarks).

### HYG-06 — UFB-061 resolved

Login page footer now surfaces `NEXT_PUBLIC_APP_VERSION` build-time env var. `.env.example` updated with `NEXT_PUBLIC_APP_VERSION=` placeholder and documentation comment.

### HYG-07 — Phase 43 GAP-01 closed

`.planning/phases/43-tooling-leaf-fix-sweep/43-SUMMARY.md` created retroactively documenting the tooling/leaf-fix-sweep work.

## Verification

```bash
ls .planning/plans/*.md | wc -l            # ≤ 1 (only pure-mist)
ls *.png 2>/dev/null                       # 0 matches
grep "NEXT_PUBLIC_APP_VERSION" .env.example  # exists
cat .planning/phases/43-tooling-leaf-fix-sweep/43-SUMMARY.md  # exists
```

## Status

`passed` — all 7 HYG items closed.
