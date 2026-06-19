# Handoff — implement seed enrichment + Mine-hides-unowned-stages

**Repo:** `/Users/wrk/work/customreport` · **Branch:** `openspec-toolbar-followups`
· **Date:** 2026-06-18

## Bottom line

Two new OpenSpec changes are authored, validated, and committed — **not yet
implemented**. A new session implements them (seed first). The earlier toolbar
follow-ups on this branch are fully done; only their OpenSpec archive is
pending.

## Branch state

- Branch `openspec-toolbar-followups`, tree clean, **3 local commits ahead of
  origin** (not pushed — branch-only flow; push or open a PR when ready):
  - `63fa051e` toolbar: mode-adaptive collapse/fullscreen control + `--color-surface` fix
  - `7c5a77c0` toolbar: harden slides fullscreen test guard + stale comment
  - `4f9c9d0c` docs: the two proposals below
- `main` is `df8d9559`. Push to main is gated → use a PR.

## What to implement (in order)

### 1. `enrich-small-seed-cross-author` (do first — data only, immediate payoff)

`openspec/changes/enrich-small-seed-cross-author/` (proposal + tasks +
`specs/demo-seed-datasets/spec.md`). Edit `prisma/seed-demo.ts` `SMALL_DATASET`:

- Add 2–3 co-owner leads (fixed UUIDs, deterministic).
- Split stage ownership across the 3 products so the **same colleague owns the
  same stage(s) on each product** (role-shaped, not random).
- One product (internal "eBay"-style) → **Vasily owns exactly 2 stages**, one
  stage (e.g. Testing) **left unowned** (tester not hired).
- Seed each co-owner a minimal foreign contribution (current-week item + a
  risk/decision) on a shared product, so **Everyone** has real foreign rows.
- Keep `seed-determinism`: fixed ids/dates, no `Date.now()`/random; idempotent
  under `prisma migrate reset` + reseed.

Reference for the shape: `prisma/seed-simple.ts` already does cross-author
co-ownership (Boris/Victor/Galina co-own Vasily's PROD_CRM) — copy that pattern
into the small tier at a smaller scale.

### 2. `lead-mine-hide-unowned-stages` (behavior — regression-sensitive)

`openspec/changes/lead-mine-hide-unowned-stages/` (proposal + tasks +
`specs/lead-pipeline-card/spec.md`).

- **Mine** → render only `ownership: "mine"` stage chips; hide foreign-owned and
  vacant (not greyed).
- **Everyone** → own + foreign-owned (locked) + vacant chips.
- Health (left edge) and own-input completeness MUST stay unchanged when chips
  are hidden — both derive from risks/status + owned-stage set, not from
  rendered chips. Add a test proving health stays honest in Mine when a covering
  foreign chip is hidden.
- Product with zero own stages in Mine → still render the card + health, show a
  "No stages assigned to you" note (not an empty grid).
- Add `TODO(why-status)` near the `stage-chip.tsx` tooltip composition for the
  deferred risk-attribution affordance (no UI now).
- Code: `sdlc-pipeline.tsx`, feed in `lib/mappers/lead-form.ts` +
  `lib/mappers/lead-cross-author.ts`. Update pipeline tests/snapshots that
  assume a fixed seven-chip grid.

### 3. Archive the finished toolbar changes

`slide-mode-collapse-fullscreen-control` and `fix-surface-token-integrity` are
✓ Complete. `openspec archive <id> -y` each (use `--skip-specs` only if it
aborts on pre-existing main-spec debt — see memory `openspec-archive-spec-debt`).

## Locked decisions (from the live-demo grill, do not re-litigate)

- Mine: **hide** non-own stages fully (not grey, not collapse-to-counter).
- Seed: **enrich the small tier** (not swap the demo to the middle tier).
- "Why this status" tooltip: **deferred** (TODO only).
- Agent-review "Coming Soon" tooltip: **not a bug** — verified live it fades in
  on hover (opacity 0→1, no clipping). Leave as-is.

## Gates & verify

- `npx prisma generate` before gates (client gets wiped — memory
  `prisma-client-wipe-recurring`).
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` on changed
  files (Codex stop-hook blocks on Prettier drift OR spec↔impl drift).
- Dev env: `docker compose up -d postgres redis`; dev-login
  `localhost:3000/auth/dev-login?role=lead&email=lead1@customreport.local&redirect=/lead/report`.
  Live-verify at 1200px: Mine shows only own stages; Everyone reveals
  foreign/vacant; the internal product shows 2 owned + 1 vacant; toggle visibly
  changes content. This area is regression-heavy.

## Memory pointers

- `demo-feedback-pipeline-visibility-2026-06-18` — these two changes + decisions.
- `toolbar-followups-implemented-2026-06-18` — the finished toolbar work.
- `lead-own-scope-decision-2026-06-17`, `three-changes-impl-2026-06-17` — the
  Mine/Everyone toggle history (regression-heavy area).
- `contract-green-not-verified` — prove test nets by induced failure.
