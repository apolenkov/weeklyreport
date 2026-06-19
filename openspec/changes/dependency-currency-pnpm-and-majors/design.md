# Design

## Decision 1 — Bundle the wave, supersede isolation for this change only

The `dependency-currency` spec practices one-major-per-isolated-change (the
2026-05-30 wave: `upgrade-bull-board-api-major`, `upgrade-typescript-major`,
etc.), rationale: a failed major blocks only itself. This change bundles
instead. Why it is acceptable here:

- Pre-production MVP; DB disposable; no prod deploy; the merge decision is the
  user's, so a bad bundle is rejected wholesale at review, not shipped.
- The riskiest item (the pnpm-config security fix) is independent and low-risk;
  the three majors are each assessed low-risk below.
- One coordinated review pass (the Codex Act-2 loop) over a small,
  related set is cheaper than four.

Trade-off accepted: if one major regresses a gate, the whole change is held,
including the security fix. Mitigation: implement in the phase order below and
keep each phase a separately-revertable commit, so the config fix can be
cherry-picked out if a later major fails.

## Decision 2 — pnpm settings move, proven by the lockfile

The move itself is mechanical (cut `overrides` + `patchedDependencies` from the
`package.json` `pnpm` field, paste into `pnpm-workspace.yaml` beside
`onlyBuiltDependencies`). The risk is silent loss, so acceptance is the
LOCKFILE, not the manifest: after `pnpm install`, `pnpm-lock.yaml` MUST still
show the `overrides` block, the `patchedDependencies` entry for
`samlify@2.13.1`, and a resolved `vite >=7.3.2`. The pnpm "field ignored"
warning MUST be gone. `patchedDependencies` in `pnpm-workspace.yaml` uses the
map form `'samlify@2.13.1': patches/samlify@2.13.1.patch`.

## Decision 3 — react-email: umbrella over the frozen scoped packages

Empirical findings (2026-06-19, npm registry):

- `@react-email/components@1.0.12` (current) is 14 KB but DEPRECATED, and every
  scoped `@react-email/<component>` it wraps (`html`, `tailwind`, `button`,
  `section`, …) is ALSO deprecated and frozen. Only `@react-email/render`
  (2.0.9) is alive.
- `react-email@6.6.3` is the single maintained successor: 4.7 MB, re-exports
  the full imported set (`Body, Button, Container, Head, Heading, Html,
Preview, Section, Tailwind, Text`) plus `render`. Verified via `npm pack` +
  grep of `dist/index.d.mts`: all 10 components are named exports and `render`
  arrives through `export * from "@react-email/render"` (line 7) — so removing
  the direct `@react-email/render` dep is safe, the umbrella re-exports it.
  React peer `^18 || ^19` (React 19.2 OK). Its `exports` map exposes only the
  lib barrel (`dist/index.mjs|cjs`); the CLI is a separate `bin`, so
  socket.io/esbuild/chokidar are installed (image/audit cost) but not loaded at
  runtime. Still, Task 3.1 re-confirms the `render` export at implementation
  before removing the dep.

Chosen: migrate to the umbrella. The frozen deprecated path has no security
future; the umbrella's only real cost is install/image size, acceptable for an
MVP backend whose email path changes rarely. Imports change in exactly three
files: `render-template.ts`, `deadline.template.tsx`, `escalation.template.tsx`
(the test `escalation.template.test.tsx` imports `render` too — update it).

## Decision 4 — the three majors are low-risk; verify, don't assume

- **nodemailer 9** (`^9.0.1`, the current maintained major — re-confirm at
  implementation): breaking change is TLS-cert validation for remote-content/
  OAuth2/proxy HTTPS sub-requests. `email.service.ts` uses none of those
  (`jsonTransport` dev; SMTP `secure:false`, text/html only, prod). `@types/nodemailer`
  stays at `^8.0.1`: no `@types/nodemailer@9` exists and `nodemailer@9` bundles
  no types, so the stub-removal precondition fails — keep the current maintained
  stub, typecheck against nodemailer 9, and record the types-major lag (the
  main spec's Node-types requirement allows a recorded justification). Gate:
  live Mailpit send via `sendMailMultipart` arrives intact.
- **@bull-board 8**: the v8 changelog documents no behavioral breaking changes
  (date-fns → Intl internals), but the module uses subpath imports
  (`@bull-board/api/bullMQAdapter`), so the v8 import paths/call shapes are
  verified and migrated where they differ — "no behavioral break" is not "no
  API change". Coupled pair must share the v8 major (mixed-major = runtime
  adapter mismatch). Gate: `/admin/queues` still mounts head-gated and lists
  `pdf-export` + `email-reminder`.
- **eslint-plugin-unicorn 68**: curated allowlist in `eslint.config.ts`; risk is
  a renamed/removed rule in the allowlist. Gate: `pnpm lint` clean with no rule
  disabled to pass.

## Out of scope

- The ~50 patch/minor bumps (recorded `dependency-upgrades-minor` batch).
- `@types/node` → 26 (correctly behind the Node 24/25 runtime per spec).
- `prettier` exact-pin `3.4.2` (a minor-batch concern, noted for that batch).
- Re-running the per-major isolation philosophy for future waves (unchanged
  for every other package; superseded here only for the bundled set).
