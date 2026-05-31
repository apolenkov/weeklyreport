# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

> RESULT (2026-05-30): investigation found NO maintained successor. Per the
> pre-flight STOP rule, the bump/migration/verification steps are intentionally
> not executed; `^1.0.12` is retained as the recorded fallback. See proposal
> "Outcome" and the spec delta.

## Pre-flight

- [x] Read the deprecation notice for `@react-email/components@1.0.12` on the
      registry (`npm view @react-email/components` / registry page) and record
      the exact recommended successor: republished package, the `react-email`
      umbrella, or the individual `@react-email/<component>` scoped packages.
      Confirm the deprecation applies to the in-use version line and is not a
      stale or mis-scoped registry flag.
      → Generic "Package no longer supported" boilerplate across the whole
      line; `1.0.12` is latest (no newer target); umbrella `react-email@6.5.0`
      is the CLI/preview, not the component set; no scoped/republished successor
      covers the imports.
- [x] Read the successor's release notes / migration guide and list every
      breaking change touching the imported set: `Html, Head, Preview, Tailwind,
Body, Container, Heading, Text, Button, Section` (renames, removals,
      changed props, `<Tailwind>` behavior).
      → N/A: no successor exists to read notes for.
- [x] Confirm the successor's peer-dep / React baseline is satisfied by
      `apps/api` (`react@^19.2.6`) and whether it forces a coordinated
      `@react-email/render` bump from `^2.0.8`.
      → N/A: no successor. `@react-email/render@^2.0.8` is not deprecated and
      stays untouched.
- [x] Confirm `@react-email/components` is declared only in
      `apps/api/package.json` so the bump is genuinely isolated.
- [x] If no maintained successor covers the imported component set, STOP: record
      the finding and report to the user instead of forcing the change.
      → STOP taken. Finding recorded in proposal "Outcome" + spec delta.

## Bump — N/A (no successor)

- [x] ~~Replace `@react-email/components` `^1.0.12` with the confirmed
      successor.~~ N/A: no successor; `^1.0.12` retained as fallback.
- [x] ~~Run `pnpm install` to refresh the lockfile.~~ N/A: no dependency change.

## Migration — N/A (no successor)

- [x] ~~Apply the official codemod / update imports in the two templates.~~
      N/A: no successor import path to migrate to.
- [x] ~~Re-search for remaining `@react-email/components` references.~~ N/A.
- [x] ~~Migrate each breaking change.~~ N/A: nothing migrated.

## Verification

- [x] Run the email tests and confirm `renderEmail` still returns
      `{subject, html, text}` with both multipart halves intact for `deadline`
      and `escalation`. → The fallback keeps the current `1.0.12` behavior;
      `render-template.test.ts` remains the standing guard (unchanged, still
      green on `main`).
- [x] ~~Update `render-template.test.ts` assertions if HTML shifts.~~ N/A: no
      render change, no assertion change.

## Gates

- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` are green on
      `main` (no code change in this decision-only outcome).
- [x] `pnpm lint:md` green (only Markdown docs in this change touched; validated
      below).
- [x] `openspec validate upgrade-react-email-components-major --strict` passes.
- [x] Finding reported to the user: no maintained successor as of 2026-05-30;
      `^1.0.12` retained as recorded fallback, `@react-email/render@^2.0.8`
      untouched, behavior guarded by `render-template.test.ts`.
