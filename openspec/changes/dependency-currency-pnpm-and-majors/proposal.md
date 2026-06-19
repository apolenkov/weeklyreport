# Harden dependency currency: pnpm config + bundled majors + react-email

## Why

A currency audit (2026-06-19) found the stack is on the latest major of almost
everything (Next 16, React 19, Nest 11, Prisma 7, ESLint 10, TS 6, Zod 4,
Vite 8, tRPC 11), with ~55/56 packages drifting only patch/minor. But three
issues sit outside the recorded `dependency-currency` decisions and one
recorded decision is now stale:

1. **pnpm settings drift — security-relevant.** The installed pnpm (10.11.0)
   no longer reads the `pnpm` field in `package.json` and warns that
   `overrides`, `patchedDependencies`, and `onlyBuiltDependencies` are ignored.
   Only `onlyBuiltDependencies` was migrated to `pnpm-workspace.yaml`. The
   security-floor `overrides` (`@xmldom/xmldom`, `protobufjs`, `vite`,
   `fast-uri`) and the `samlify@2.13.1` patch (SAML auth) still live in the
   ignored location. They are applied right now only because the committed
   lockfile carries them; the next lockfile regeneration could silently drop
   the floors and the SAML patch.

2. **`@react-email/components` deprecation — recorded decision is now stale.**
   The `dependency-currency` spec retained `@react-email/components@^1.0.12` as
   a fallback because "no maintained successor exists." React Email 6
   consolidated all components + the renderer into the single maintained
   `react-email` package (6.6.3) and deprecated every scoped package
   (`@react-email/components` AND each `@react-email/<component>`); only
   `@react-email/render` stays alive. The spec's own reopening condition —
   "a maintained successor that re-exports the imported component set is
   published" — is met. Staying on a frozen, deprecated package with no
   security path is the larger risk; the umbrella's cost is install/image size,
   not runtime (its lib entry is separate from the CLI `bin`).

3. **Three majors not covered by any recorded decision.** `nodemailer` 8→9,
   `@bull-board/*` 7→8, and `eslint-plugin-unicorn` 65→68 each ship a new major
   the spec does not yet address. `@bull-board` additionally contradicts the
   spec, which currently pins it to v7.

## What Changes

This change **deliberately bundles** the pnpm-config fix, the three majors, and
the react-email migration into ONE change, and the merge decision stays with
the user. This supersedes — for THIS wave only — the spec's per-major isolation
posture as it applies to all four bundled majors (`nodemailer`, `@bull-board`,
`eslint-plugin-unicorn`, `react-email`): the `@bull-board` and `react-email`
explicit isolation clauses, and the surviving "Minor And Patch Upgrades" rule
that each major be "deferred to its own isolated change". The rationale (a
failed major blocks only itself) is traded for a single coordinated review pass
on a pre-production MVP, mitigated by keeping each major a separately revertable
commit. The ~50 patch/minor bumps stay out of scope (the recorded
`dependency-upgrades-minor` batch).

### 1. Move pnpm `overrides` + `patchedDependencies` to `pnpm-workspace.yaml`

So pnpm reads them again. The lockfile MUST still carry the security floors and
the `samlify` patch after the move — proven, not assumed.

### 2. Bump the three majors

- `nodemailer` 8→9. The only 9.0 breaking change (TLS validation default for
  remote-content/OAuth2/proxy HTTPS) does not touch our path: dev uses
  `jsonTransport`, prod uses SMTP `secure:false` with no remote attachments,
  OAuth2, or proxy. `@types/nodemailer` stays at `^8.0.1` (no `@types/nodemailer@9`
  is published and `nodemailer@9` ships no bundled types); the types-major lag
  is typecheck-verified and recorded, not stranded.
- `@bull-board/api` + `@bull-board/express` 7→8 in lockstep. v8 documents no
  behavioral breaking changes (date-fns → Intl internals); any v8
  import-path/call-shape difference is migrated, with the dev queue dashboard
  mount behaviorally unchanged.
- `eslint-plugin-unicorn` 65→68. A curated rule allowlist, not the preset;
  every enabled rule MUST still resolve and `pnpm lint` MUST stay clean.

### 3. Migrate `@react-email/components` → `react-email` 6.x

Replace `@react-email/components` and `@react-email/render` imports with
`react-email` in `render-template.ts` and the two templates. Rendered
transactional-email behavior MUST stay byte-equivalent, guarded by the existing
render tests and a live Mailpit send.

## Impact

- Specs: `dependency-currency` (ADD pnpm-settings, nodemailer, unicorn; REMOVE
  the react-email fallback requirement; ADD the react-email migration
  requirement; MODIFY the three `@bull-board` requirements v7→v8).
- Code: `pnpm-workspace.yaml`, root `package.json`, `apps/api/package.json`,
  `apps/api/src/modules/email/**`, `apps/api/src/infrastructure/bullmq/bull-board.module.ts`,
  `pnpm-lock.yaml`.
- No production runtime contract changes; MVP, DB disposable, no prod deploy.
