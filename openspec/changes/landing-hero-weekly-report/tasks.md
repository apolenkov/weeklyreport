# Tasks — Landing hero «Weekly Report» de-pulse

## 1. Wordmark → «Weekly Report»

- [x] 1.1 In `pulse-mark.tsx`, change the eyebrow text `YOUR` → `WEEKLY`
      and the display text `PULSE` → `REPORT`; set the container
      `aria-label` to `Weekly Report`.
- [x] 1.2 In `login-page.client.tsx`, change the `sr-only` `<h1>` from
      "Your PULSE — Status Reporting System" to "Weekly Report"; update
      the stale `PulseMark` / ECG comments to match the new intent.

## 2. Remove the pulse animation

- [x] 2.1 In `pulse.css` `.pulse-strong`, remove the
      `animation: pulse-breathe ...` declaration (word renders static);
      keep the static gradient text-fill styling.
- [x] 2.2 In `pulse-background.tsx`, remove the ECG `<svg>` layer (both
      `ECG_PRIMARY_D` / `ECG_SECONDARY_D` paths and the constants);
      keep `.pulse-bg` gradient, `.pulse-bg-dots`, and the `::after`
      hairline.
- [x] 2.3 In `pulse.css`, delete `.pulse-bg-ecg` rules and the now-dead
      keyframes `pulse-breathe`, `pulse-ecg-scan`, `pulse-q-breathe`,
      `pulse-q-dot`; remove the `prefers-reduced-motion` block once its
      only targets (`.pulse-strong`, `.pulse-bg-ecg path`) are gone.

## 3. Tests

- [x] 3.1 Update `pulse-mark.test.tsx`: accessible name / `aria-label`
      assertions `Your PULSE` → `Weekly Report`; visible text
      `YOUR`/`PULSE` → `WEEKLY`/`REPORT`.
- [x] 3.2 Update `pulse-background.test.tsx`: assert no ECG path / no
      `.pulse-bg-ecg` is rendered; keep gradient + dots assertions.
- [x] 3.3 Refresh landing `__snapshots__/` for the changed output.
- [x] 3.4 Add/adjust a test asserting the brand wordmark reads
      "Weekly Report" and no `pulse-breathe` / `pulse-ecg-scan`
      animation is referenced (spec scenarios).

## 4. Gates + verify

- [x] 4.1 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green.
- [x] 4.2 Live-verify on `http://localhost:3000`: hero reads
      "Weekly Report", no breathing word, no moving ECG trace, column +
      tagline intact; check `prefers-reduced-motion` still renders cleanly.
- [x] 4.3 `openspec validate landing-hero-weekly-report --strict` green.
