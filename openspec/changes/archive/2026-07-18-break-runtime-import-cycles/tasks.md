# Tasks

## 1. C1 — tab-header → shared/ui

- [x] 1.1 Move file, rewrite 9 import sites, drop admin barrel line
- [x] 1.2 Gates green (typecheck, lint, web unit)

## 2. C2 — api human-session extraction

- [x] 2.1 Create `lib/human-session.ts`; trpc.context + pdf-export download-handler import from it
- [x] 2.2 Gates green (typecheck, lint, api unit)

## 3. C3 — item-card-actions → report-sections

- [x] 3.1 Move file, rewrite consumers, adjust period/report-sections barrels
- [x] 3.2 Gates green

## 4. C4 — carve report-pages + slides reassignment

- [x] 4.1 Move upper-floor files (+tests/snapshots) to `features/report-pages`; new barrel
- [x] 4.2 Move use-slide-inline-editor + slide-inline-editor-dialogs to `features/slides`
- [x] 4.3 report-sections barrel: remove upper-floor exports, add lower-floor exports movers need
- [x] 4.4 Rewrite external sites (app router, viewer, slides), 5 vi.mock string paths
- [x] 4.5 eslint.config.ts: webSlices += report-pages; repoint mover exempt entries
- [x] 4.6 Gates green; `pnpm depcruise` = 0 errors

## 5. Gate wiring

- [x] 5.1 Fix duplicate export in `packages/shared/src/schemas/review.schema.ts`
- [x] 5.2 Root `lint` += `pnpm depcruise && pnpm knip`; clean knip.json hint entries
- [x] 5.3 Raise typecov floors (ui 99.9, api 99.95, web 99.6; shared stays 100)
- [x] 5.4 Full gate + live verify (lead form, weekly report, slides, admin, viewer)
