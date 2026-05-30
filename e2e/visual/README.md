# Visual Regression — Playwright `toHaveScreenshot()` baselines

Phase 39-06. Five frozen pixel-diff baselines captured at 1280×800, ru-RU,
light mode, frozen clock 2026-05-06 10:00 UTC. Every PR re-runs these and
fails on >0.1% pixel drift.

## Pages covered

| Spec                     | Route                    | Auth                    | Why it matters                           |
| ------------------------ | ------------------------ | ----------------------- | ---------------------------------------- |
| `landing.spec.ts`        | `/` (logged out)         | none (`AUTH_STUB=true`) | First impression — dev-login picker grid |
| `lead-report.spec.ts`    | `/lead/report`           | seeded lead             | The form 6 leads fill in every week      |
| `head-dashboard.spec.ts` | `/head/dashboard`        | seeded head             | Traffic-light overview + activity feed   |
| `reports.spec.ts`        | `/reports?tab=published` | seeded head             | Archive view of published reports        |
| `admin.spec.ts`          | `/admin?tab=jobs`        | seeded head             | BullMQ DLQ admin UI                      |

## Determinism — two knobs

A baseline is worthless if it's flaky. Two sources of non-determinism are
locked down:

1. **Clock** — `page.clock.install({ time: 2026-05-06T10:00:00Z })` is
   called BEFORE every `goto()` in `_helpers.ts → freezeClock()`. Patches
   `Date.now`, `setTimeout`, `setInterval`, `requestAnimationFrame`, etc.
2. **Seed data** — `seed-simple` uses hard-coded UUIDs and an
   anchor-week-derived period so every reset produces byte-identical rows.
   Run `pnpm --filter @customreport/web visual:setup` before capturing.

Time-relative DOM nodes (`<time>` tags, activity-panel "X минут назад"
strings) are masked via `driftyMasks(page)` instead of being relied on
to hold still — masking keeps the diff tight while staying robust.

## Workflows

### Run the suite locally

```bash
# 1. Wipe and re-seed the DB (deterministic fixture)
pnpm --filter @customreport/web visual:setup

# 2. Compare against baselines
pnpm --filter @customreport/web visual:test
```

### Update a baseline (intentional UI change)

1. Make the UI change.
2. Run `pnpm --filter @customreport/web visual:update` — Playwright
   regenerates every PNG under `e2e/visual/*-snapshots/`.
3. Eyeball the diff (`git diff --stat`) — if changed PNG count matches
   what you expected, commit. If it doesn't, you may have introduced an
   unintended regression elsewhere.

### Debug a fail

Failed runs write three artefacts per spec to
`apps/web/e2e/.results/<spec>/`:

- `<spec>-actual.png` — what the test actually captured
- `<spec>-expected.png` — the committed baseline it diffed against
- `<spec>-diff.png` — red-highlighted pixel mismatch

Open the diff PNG. If the change is intentional, run `visual:update`. If
not, trace the regression.

### Add a new page

1. Copy `landing.spec.ts` → `<your-page>.spec.ts`.
2. Replace the route + adjust the wait (heading text, locator, etc).
3. Pick the right fixture (`leadPage` / `headPage` / unauthenticated).
4. Run `visual:update` once to seed the baseline. Inspect the PNG before
   committing — if it looks wrong, fix the spec, don't commit a bad
   baseline.

## Snapshot storage layout

Playwright pins snapshots by `(spec file, project, OS)`:

```
e2e/visual/
  landing.spec.ts-snapshots/
    landing-visual-darwin.png       ← captured locally on macOS
    landing-visual-linux.png        ← captured by CI on Ubuntu
  lead-report.spec.ts-snapshots/
  …
```

Both OS variants are committed. CI uses the linux variant; local dev uses
darwin. If you only have one variant, the other OS will fail until that
baseline lands.

## Caveats

- **Dark mode** is deferred to v8.1 — only light is captured today. When
  the dark palette ships, add a second project entry mirroring `visual`
  with `colorScheme: 'dark'`.
- **Mobile viewports** not captured — visual baseline is desktop only for
  now. Responsive tests live separately under `e2e/responsive/`.
- **Print routes** (`/reports/<id>/print`) not part of this baseline set
  — covered by the existing PDF E2E suite.
