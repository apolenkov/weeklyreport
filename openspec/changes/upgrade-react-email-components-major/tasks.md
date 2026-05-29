# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [ ] Read the deprecation notice for `@react-email/components@1.0.12` on the
      registry (`npm view @react-email/components` / registry page) and record
      the exact recommended successor: republished package, the `react-email`
      umbrella, or the individual `@react-email/<component>` scoped packages.
      Confirm the deprecation applies to the in-use version line and is not a
      stale or mis-scoped registry flag.
- [ ] Read the successor's release notes / migration guide and list every
      breaking change touching the imported set: `Html, Head, Preview, Tailwind,
    Body, Container, Heading, Text, Button, Section` (renames, removals,
      changed props, `<Tailwind>` behavior).
- [ ] Confirm the successor's peer-dep / React baseline is satisfied by
      `apps/api` (`react@^19.2.6`) and whether it forces a coordinated
      `@react-email/render` bump from `^2.0.8`.
- [ ] Confirm `@react-email/components` is declared only in
      `apps/api/package.json` so the bump is genuinely isolated.
- [ ] If no maintained successor covers the imported component set, STOP: record
      the finding and report to the user instead of forcing the change.

## Bump

- [ ] Replace `@react-email/components` `^1.0.12` in `apps/api/package.json`
      dependencies with the confirmed successor (and, only if forced, the
      aligned `@react-email/render` version).
- [ ] Run `pnpm install` to refresh `pnpm-lock.yaml`; verify the resolved
      successor version and that no unexpected peer-dep warnings appear.

## Migration

- [ ] Apply the official codemod if one is published; otherwise update imports
      by hand in
      `apps/api/src/modules/email/templates/deadline.template.tsx` and
      `apps/api/src/modules/email/templates/escalation.template.tsx` to the
      successor's import path.
- [ ] Re-search for any remaining `@react-email/components` references
      (`grep -rn "@react-email/components" apps/api/src`) and migrate them.
- [ ] Migrate each breaking change found in pre-flight (renamed/removed
      components, changed props, `<Tailwind>` semantics). Fix the cause; do not
      shim around a removed API.

## Verification

- [ ] Run the email tests
      (`pnpm --filter @customreport/api test -- render-template`) and confirm
      `renderEmail` still returns `{subject, html, text}` with the multipart
      HTML + plaintext halves intact for both `deadline` and `escalation`.
- [ ] If the rendered HTML structure shifts, update
      `render-template.test.ts` assertions to the new output deliberately and
      record why; do not skip or delete a test to go green.

## Gates

- [ ] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] Run `pnpm lint:md`.
- [ ] `openspec validate upgrade-react-email-components-major --strict` passes.
- [ ] Hand the merge decision to the user with a short note: confirmed
      successor and version, breaking changes hit, files touched, and whether
      the rendered email output changed.
