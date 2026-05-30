# Upgrade `@react-email/components` off the deprecated release

## Outcome (2026-05-30): retain `^1.0.12` as recorded fallback

Investigation is complete and the result is **no migration**. Verified against
the registry on 2026-05-30:

- `@react-email/components` is deprecated with the generic boilerplate
  ("Package no longer supported. Contact Support…") across the whole version
  line; `1.0.12` is the latest published version (no newer target exists).
- The `react-email` umbrella (`6.5.0`) is the CLI/preview tool, not the
  component set, so it does not re-export the imported components.
- No republished package and no individual `@react-email/<component>` scoped set
  covers the imported components either.
- The companion `@react-email/render@^2.0.8` is **not** deprecated and stays.

Per the "No maintained successor exists" path, `^1.0.12` is kept as the
deliberate fallback, guarded by `render-template.test.ts`, and revisited when a
maintained successor ships. The spec delta records this as the durable
requirement. This change is archived as the record of that decision.

## Why

`@react-email/components` (`^1.0.12`, declared in `apps/api/package.json`) is
flagged **Deprecated** on the registry. It is not a routine version bump: the
deprecation means the currently-pinned line no longer receives fixes and a
successor/republished package must be identified before changing anything.

The package supplies the JSX primitives used by the two transactional email
templates on the nodemailer path:

- `apps/api/src/modules/email/templates/deadline.template.tsx` — imports
  `Html, Head, Preview, Tailwind, Body, Container, Heading, Text, Button,
Section`.
- `apps/api/src/modules/email/templates/escalation.template.tsx` — imports
  `Html, Head, Preview, Tailwind, Body, Container, Heading, Text, Section`.

The companion renderer `@react-email/render` (`^2.0.8`, used in
`apps/api/src/modules/email/render-template.ts`) is **not** deprecated and is
out of scope except where the chosen successor forces a coordinated bump.

This change is **isolated**: a single deprecated dependency must not sink the
larger upgrade batch. The merge decision is the user's.

## What Changes

- Investigate the deprecation notice for `@react-email/components@1.0.12` and
  record the registry-recommended successor. Likely outcomes, to be confirmed
  against the actual notice before any edit:
  - a republished / renamed package that re-exports the same component set, or
  - the `react-email` umbrella package, or
  - the individual `@react-email/<component>` scoped packages.
- Replace the deprecated dependency in `apps/api/package.json` with the
  confirmed successor and refresh `pnpm-lock.yaml`.
- Update the import sites in the two template files (and any others surfaced by
  search) to the successor's import path, applying any official codemod and
  migrating every breaking change (renamed/removed components, changed props,
  `<Tailwind>` behavior, peer-dep / React baseline shifts).
- Keep `@react-email/render` aligned only if the successor's peer range
  requires it; otherwise leave it untouched to preserve isolation.
- Re-run the existing email tests
  (`apps/api/src/modules/email/render-template.test.ts`) and confirm rendered
  HTML + plaintext multipart output is unchanged in shape; fix causes, never
  skip or delete a test to go green.
- Run the full gate set and hand the merge decision to the user.

## Impact

- **Affected package:** `apps/api` (`@customreport/api`) only.
- **Affected files:** `apps/api/package.json`, `pnpm-lock.yaml`,
  `apps/api/src/modules/email/templates/deadline.template.tsx`,
  `apps/api/src/modules/email/templates/escalation.template.tsx`, and possibly
  `apps/api/src/modules/email/render-template.ts` if a coordinated
  `@react-email/render` bump is forced.
- **Risk:** Medium. The transactional email path (deadline reminders,
  escalation digests) is the only consumer; it is covered by
  `render-template.test.ts`. The chief unknown is the successor identity and
  whether component/prop signatures changed across the deprecation. If no safe
  successor exists, the change is blocked and reported rather than forced.
- **Isolation:** No other dependency moves with this bump; a failed validation
  can be rejected without touching unrelated work.
