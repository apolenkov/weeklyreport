## Why

The parent change `restructure-directory-architecture` task 3.1 relocates the
remaining web domains one slice at a time. `apps/web/src/components/lead/` (54
source files, ~101 with tests/snapshots) is the linchpin: unlike the other
domains it is not a single slice — it **dissolves** across six homes, and it
**creates** the `features/report-sections/` slice that `head-report-shell`,
`viewer-report-shell`, and the `weekly-report/` dissolution all depend on. Its
placement is fixed by `docs/architecture/mapping/web-comp-lead-2026-07-02.md`.

Two independent advisers (deep-reasoner + Codex) reviewed the split strategy;
their consensus + the adjudicated forks drive this change (see design notes below).

## What Changes

- **Dissolve `components/lead/` across six homes** (behavior-neutral `git mv` +
  import reroute), one atomic change so the orchestrator `lead-form.tsx` — which
  deep-imports siblings destined for every home — never leaves a red intermediate
  tree and no transient `features/ → components/lead` backward import is created:
  - `features/report-sections/{ui,model}/` — the new slice: `lead-form`, `item-card*`,
    `item-edit-dialog`, `next-week-section`, `product-picker`, `quick-add-button`,
    `stage-chip`, `stage-multi-select`, `unified-activity-section`, `board-column-header`,
    `board-empty-state`, `activity-lanes-block` (ui); `mock-data`, `stage-tags`,
    `stage-chip-config`, `item-card-style`, `next-week-columns`, `record-parent`,
    `stage-ownership` (model).
  - `features/period/{ui,model}/` — `current-week-section`, `decision*`, `fill-from-*`,
    `item-card-actions`, `lead-history-*`, `period-*`, `record-stage-step`,
    `request-reopen-dialog`, `sdlc-collapsed-indicator`, `sdlc-pipeline`,
    `pause-reason-dialog` (ui); `sdlc-hidden-stages`, `sdlc-pipeline-health`,
    `use-period-listbox-nav` (model).
  - `features/review/ui/` — `lead-review-feedback`, `risk-card*`, `risk-edit-dialog`,
    `risks-section`.
  - `features/pdf-export/ui/` (new) — `pdf-export-coming-soon`;
    `features/admin/ui/` — `version-coming-soon`;
    `shared/ui/` — `confirm-delete-dialog` (rule-of-2).
- **The 4 files postdating the mapping catalog** are assigned by dependency
  analogy: `board-column-header`, `board-empty-state`, `activity-lanes-block` →
  `report-sections/ui` (item-board kit, deps are report-sections `ItemColumn`/model,
  sibling of `next-week-section`); `pause-reason-dialog` → `period/ui` (sole
  consumer `current-week-section`, zero report-sections deps).
- **Kernel high-fan-in files** (`mock-data`, `stage-tags`, `stage-chip-config`)
  land in `report-sections/model` per the mapping — they encode report-section
  SDLC domain logic, not business-agnostic helpers, so they do **not** go to
  `shared/`. Their tree-wide external consumers (`hooks/`, `lib/`, `head/`,
  `viewer/`, `weekly-report/`, `slides/`) are rerouted to the new paths.
- **`slides/` (2 committed edges) rerouted** to `report-sections/model`:
  `slides/section-slide-utils.ts` (`stage-tags`) and `slides/slide-article-rows.tsx`
  (`stage-chip-config`). Approved by the owner; `slides/` is not a slice, so no
  zone-5 entry is needed for these edges.
- **eslint.config.ts** — the 10 path-pinned complexity/max-lines/cognitive
  exemptions for lead files are repointed to their new paths (`lead-form`,
  `item-edit-dialog`, `risk-edit-dialog`, `decision-edit-dialog`, `mock-data`,
  `lead-form-sync-bridge`, `lead-history-sidebar`, `next-week-section`,
  `risks-section`, `stage-chip`). **No** `webSlices` / zone-5 `except` change:
  following the `admin` dissolve precedent (commit `8b758fb7`), a multi-home
  dissolve moves files without enabling cross-slice enforcement — the current
  `except: [sliceName]` shape can only grandfather at slice granularity, so
  turning enforcement on now would force refactoring the pre-existing cross-slice
  couplings; that flip is a dedicated later boundaries slice.

## Non-goals

- No component logic, props, or rendered output change — pure relocation + reroute.
- No cross-slice coupling refactor and no zone-5 enforcement flip (deferred).
- No move of `slides/` itself (deferred, owner-parallel) beyond its 2 import lines;
  no move of `head`/`viewer`/`weekly-report` (their own later slices, now unblocked).

## Impact

- Affected code: ~101 relocated files across `features/{report-sections,period,review,pdf-export,admin}`
  - `shared/ui/confirm-delete-dialog`; ~20 external consumers rerouted; 10
    `eslint.config.ts` exemption paths.
- Parent: `restructure-directory-architecture` task 3.1. Mapping:
  `docs/architecture/mapping/web-comp-lead-2026-07-02.md`.
- No load-bearing invariant touched (pure web presentation relocation; the tRPC
  middleware chains and the period dual-state write live in the api, untouched).
- Verification: cold `tsc` 0 errors, full web unit suite 1567 passing, focused
  eslint clean, and live-verified from source — `/lead/report/[id]` (LeadForm),
  `/reports`, `/head/report/[id]` all HTTP 200 with no module-resolution 500.
