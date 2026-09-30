## Why

At 375 CSS pixels, WeeklyReport hides signed-in identity, clips Admin actions and slide content, squeezes report prose, and leaves the latest Trends week outside the initial view. Meaningful small or dim labels make the remaining information harder to read. The owner-approved plan and three design reviews in `/home/user/.local/state/session-review/weeklyreport-20260929/design-fix/` define the bounded correction from source revision `81b7eab7535abd71bf1ce61c478b02b38ecd9ec0`.

## What Changes

Reuse existing components, responsive utilities, and tokens to expose mobile identity and existing actions, wrap report names and prose, show a single publication marker, and make denial and pending-count copy accurate. Keep one visible product heading on mobile sign-in. Establish a 12 CSS pixel floor and 4.5:1 contrast for meaningful ordinary text.

Render Trends period columns newest first without changing query results or calculations. Below 640 CSS pixels, fit the shared slide canvas to its container and stack labeled category cells; retain the desktop four-column grid and every record, priority, author, and disclosure. Keep Admin technical details reachable and use already available actor names only with UUID fallback. Fit the observed AI tab labels locally.

## Non-goals

- No access-policy, report-lifecycle, analytics API, persistence, or export change.
- No new dependency, query for actor names, visual theme, or navigation model.
- No dashboard redesign, Trends desktop styling expansion, feedback-overlay change, or empty Status Overview redesign (findings 10, 13–16).
- No claim that component tests or specification validation prove browser geometry or composed text contrast.

## Impact

Presentation changes in `apps/web`, shared slide styling in `packages/ui`, focused component tests, and the ten affected durable OpenSpec capabilities. Required findings are 1–8, 11, 12, and 18; observed optional findings 9 and 17 remain bounded to the same responsive changes. Other active OpenSpec changes remain independent. Acceptance requires current-source screenshots and DOM evidence at 375 and 1440 CSS pixels plus the six repository gates; this proposal does not record those checks as passed.
