# Phase 60: Presentation Mode (Slides surface across roles) — STUB

**Status:** idea / scoping (2026-05-11 in-chat capture)
**Driver:** user vision — each role gets a slide-rendered view of their data,
not only the editable form / dashboard. «Status Report» (current) and «Status
Presentation» (this phase) are two parallel menu surfaces.

## Per-role contract

| Role         | Editable surface           | Presentation surface              | Compiled artifact   |
| ------------ | -------------------------- | --------------------------------- | ------------------- |
| `lead`       | own section form (current) | own section as one polished slide | (none)              |
| `head`       | review + publish (current) | all leads' slides for own group   | PDF (current)       |
| `viewer`     | (none)                     | all slides of all groups in scope | PDF (read-only)     |
| `director`   | (none, god-mode-read)      | every group's slide deck          | PDF (read-only)     |
| `admin`      | settings only              | (delegated to dev tools)          | (delegated)         |
| `super_head` | DEFERRED — Phase 59 first  | aggregated deck per BU            | rolled-up PDF       |
| `root_head`  | DEFERRED — Phase 59 first  | full-org executive deck           | executive brief PDF |

Two nav-bar menu entries for every consumer role:

```
Status Report         (today: /head/report, /lead/report — editable)
Status Presentation   (new: /<role>/slides — read-only polished view)
```

## Why this matters

- A weekly status form is not a presentation. Today head reads tables to
  understand state; presentation mode turns the same data into the slide
  format that already lives in the PDF export, but renders it interactively
  in the app (without forcing PDF download every time).
- Lead self-presentation: lets the lead preview «what head will see» before
  hitting Submit. Removes ambiguity.
- Director / viewer: read-only polished surface is the appropriate
  consumption mode for non-editors.

## Likely shape

| Plan | Scope                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| 60-A | Slide template: one `<Slide>` component per ReportSection (already partially in print PDF)                      |
| 60-B | Route surface: `/lead/slides` (own), `/head/slides` (group), `/viewer/slides` (scope), `/director/slides` (all) |
| 60-C | Navigation: add «Status Presentation» link per role in nav-bar (group with «Status Report»)                     |
| 60-D | Slide deck navigation: ←/→ keyboard, full-screen toggle, deep-link to slide N                                   |
| 60-E | Print PDF re-uses the same `<Slide>` components — single source of truth                                        |
| 60-F | Role-scoped data fetch: re-use `groupScopeFilter` (Phase 46/56-D) + director god-mode-read                      |

## Metrics to declare day-1 (per CLAUDE.md TODO discipline)

Even before activation, register Prometheus counters so observability is
ready:

```
customreport_presentation_view_total{role,scope}     counter
customreport_presentation_slide_dwell_seconds{slide} histogram
customreport_presentation_export_total{role,format}  counter   // future PDF/PPTX exports
```

These let UAT measure adoption (which roles actually open the slides surface)
the moment the phase ships.

## Dependencies

- Phase 50/51 (period lifecycle) ✓ shipped
- Phase 46 / 56-D (scope-filter) ✓ shipped — drives «which slides am I allowed to see»
- Phase 57 (director role) ✓ shipped — director gets god-mode-read of all decks
- Phase 59 (multi-org hierarchy) — `super_head` / `root_head` rollups DEFER to 59 landing
- Print PDF infra (Playwright) — already there from earlier phases; shape it as `<Slide>` consumer

## TODO traces in current code

Per CLAUDE.md TODO discipline, add these markers when touching the listed files:

- `apps/web/src/components/weekly-report/weekly-report-page.tsx` → `TODO(Phase-60-presentation): add «Status Presentation» mode toggle`
- `apps/web/src/app/print/[reportId]/page.tsx` → `TODO(Phase-60-presentation): extract Slide components for reuse in in-app deck`
- `apps/web/src/components/navigation/nav-bar.tsx` → `TODO(Phase-60-presentation): add Slides nav link per role`
- `apps/api/src/infrastructure/metrics/metrics.registry.ts` → declare the 3 counters above as `Phase-60-pending` no-emit metrics

## Open questions for `/gsd-discuss-phase 60`

1. **One slide per ReportSection (today PDF layout) vs one slide per Project?**
   — depends on density tolerance; product call.
2. **Full-screen mode in-app vs deep-link to `/presentation` route?** — UX
   preference: in-app overlay keeps nav-bar accessible; deep-link makes
   each slide URL bookmarkable / shareable.
3. **Edit affordances visible in lead self-presentation?** — likely no
   (read-only preview); add «Edit» button that returns to form.
4. **Export format** — PDF stays primary; PPTX optional follow-up.
5. **Live vs snapshot** — slides reflect current state of data, or snapshot
   at publish? Probably current state for lead self-preview, snapshot for
   head/viewer/director on published periods.

## Use `/gsd-discuss-phase 60` when ready

Stub is broad. When this becomes near-term:

- Pick canonical slide template (1 section vs 1 project)
- Decide deep-link vs overlay
- Decide live-vs-snapshot
- Produce 60-A through 60-F plans
