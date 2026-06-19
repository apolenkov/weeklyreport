## ADDED Requirements

### Requirement: pnpm Project Settings MUST Live Where pnpm Reads Them

The repository MUST declare `overrides` and `patchedDependencies` in
`pnpm-workspace.yaml`, not in the `package.json` `pnpm` field, because the
installed pnpm (10.11.0) no longer reads that field and warns the keys are
ignored. The security-floor overrides (`@xmldom/xmldom`, `protobufjs`, `vite`,
`fast-uri`) and the `samlify@2.13.1` patch MUST stay applied across the move,
proven by the lockfile, so the SAML auth patch and the version floors are not
silently dropped on the next lockfile regeneration.

#### Scenario: Settings are read from the supported location

- **WHEN** any pnpm command runs after the move
- **THEN** no "the pnpm field ... is no longer read" warning is emitted
- **AND** `pnpm-workspace.yaml` declares `overrides` and `patchedDependencies`
  alongside the existing `onlyBuiltDependencies`
- **AND** the `package.json` `pnpm` field no longer carries `overrides` or
  `patchedDependencies`

#### Scenario: Security floors and the SAML patch survive the move

- **WHEN** `pnpm install` resolves the workspace after the move
- **THEN** `pnpm-lock.yaml` still records the `overrides` block
  (`@xmldom/xmldom>=0.8.13`, `protobufjs>=8.0.2`, `vite>=7.3.2`,
  `fast-uri>=3.1.2`)
- **AND** `pnpm-lock.yaml` still records `patchedDependencies` for
  `samlify@2.13.1` with the patch path applied
- **AND** the resolved `vite` remains `>=7.3.2`

### Requirement: nodemailer MUST Track Its Current Maintained Major

The `@customreport/api` workspace MUST pin `nodemailer` to the current
maintained major (`^9.0.1` at this change), and the transactional-email send
path MUST keep working unchanged. The nodemailer 9.0 breaking change (TLS
certificate validation defaulted on for remote-content, OAuth2-token, and
HTTP/HTTPS-proxy sub-requests) MUST be confirmed not to affect the configured
transports before the bump is accepted.

#### Scenario: The send path is unaffected by the TLS default

- **WHEN** `nodemailer@9` is resolved and `EmailService` is constructed
- **THEN** the dev `jsonTransport` path and the prod SMTP `secure:false` path
  both build with no code change beyond the version bump
- **AND** the configured transports fetch no remote attachment, use no OAuth2
  token endpoint, and route through no HTTP/HTTPS proxy, so the 9.0 TLS default
  does not change behavior

#### Scenario: A live multipart send still arrives intact

- **WHEN** `sendMailMultipart` is exercised against a local Mailpit SMTP server
  on `nodemailer@9`
- **THEN** the message arrives with both the HTML and plaintext halves intact
- **AND** no test is skipped or weakened to pass the bump

#### Scenario: The types stub is reconciled, not stranded

- **WHEN** `nodemailer` is bumped to 9 and `@customreport/api` is typechecked
- **THEN** `@types/nodemailer` is kept at its current maintained major
  (`^8.0.1`), because no `@types/nodemailer@9` is published and `nodemailer@9`
  ships no bundled types, and the typecheck passes against `nodemailer@9`
- **AND** the types major (8) lagging the runtime major (9) is recorded as the
  documented justification, not silently left as drift

### Requirement: eslint-plugin-unicorn MUST Track Its Current Maintained Major

The root `eslint-plugin-unicorn` devDependency MUST pin the current maintained
major (`^68.0.0` at this change), and the curated rule allowlist in
`eslint.config.ts` MUST keep resolving every rule it names, with `pnpm lint`
clean and no rule disabled to mask a removal or rename.

#### Scenario: The curated allowlist still resolves on the new major

- **WHEN** `pnpm lint` runs with `eslint-plugin-unicorn@68` resolved
- **THEN** every `unicorn/*` rule enabled in `eslint.config.ts` resolves to a
  real rule in the new major
- **AND** the lint gate exits 0

#### Scenario: A renamed or removed rule is migrated, not silenced

- **WHEN** the bump renames or removes a `unicorn/*` rule the allowlist enables
- **THEN** the allowlist entry is updated to the rule's new name or successor
- **AND** the rule is not simply deleted or downgraded to silence the change

### Requirement: Transactional Email MUST Track the Maintained react-email Package

The `apps/api` transactional-email templates and renderer MUST import their
components and `render` from the maintained `react-email` package (`^6.6.3` at
this change), replacing the deprecated `@react-email/components` and
`@react-email/render` scoped packages. The migration MUST preserve the rendered
email behavior exactly and MUST stay guarded by `render-template.test.ts` and a
live Mailpit send.

#### Scenario: The maintained successor reopened the retention

- **WHEN** the react-email ecosystem is re-investigated against the registry
- **THEN** `react-email@6.x` is confirmed to re-export the imported component
  set (`Body, Button, Container, Head, Heading, Html, Preview, Section,
Tailwind, Text`) plus `render`, while every scoped `@react-email/<component>`
  and `@react-email/components` is deprecated and frozen
- **AND** the retention decision is reopened and the migration applied

#### Scenario: Imports move to the umbrella in exactly the email files

- **WHEN** the migration is implemented
- **THEN** `render-template.ts`, `deadline.template.tsx`,
  `escalation.template.tsx`, and `escalation.template.test.tsx` import from
  `react-email`
- **AND** `@react-email/components` and `@react-email/render` are removed from
  `apps/api/package.json` and the lockfile

#### Scenario: Rendered behavior stays guarded

- **WHEN** `pnpm --filter @customreport/api test` runs after the migration
- **THEN** `render-template.test.ts` passes and `renderEmail` returns
  `{subject, html, text}` with both multipart halves intact for the `deadline`
  and `escalation` kinds
- **AND** a live Mailpit send renders both templates with no visual regression
- **AND** no test is skipped, quarantined, or deleted to mask a regression

### Requirement: Bull Board Mount Survives the v8 Migration Behaviorally Unchanged

The queue monitoring UI MUST still mount at `/admin/queues` after migrating
`apps/api/src/infrastructure/bullmq/bull-board.module.ts` to the `@bull-board`
v8 API, remain gated to the head role, and list the existing queues — with no
change to the route, base path, queue construction, or auth middleware.

#### Scenario: The board mounts and lists queues under v8

- **WHEN** the API starts with `@bull-board/*` on v8 and an authenticated head
  session requests `/admin/queues`
- **THEN** the v8 Bull Board UI renders and lists the `pdf-export` and
  `email-reminder` queues
- **AND** the `createBullBoard` / `BullMQAdapter` / `ExpressAdapter` wiring uses
  the v8 import paths and call shapes

#### Scenario: The head-role gate is unchanged by the bump

- **WHEN** `/admin/queues` is requested without a head session after the upgrade
- **THEN** the request is rejected with 401 (no session) or 403 (non-head role)
  exactly as before the bump
- **AND** the `requireHead` middleware and the direct `new Queue(...)`
  construction are byte-identical to their pre-upgrade form

### Requirement: The @bull-board v8 Bump MUST Pass All Gates

The `@bull-board` v8 upgrade MUST clear the full gate suite — `pnpm typecheck`,
`pnpm lint`, `pnpm test`, and `pnpm build`. Because this wave is deliberately
bundled, a gate failure holds the whole change for the user's merge decision
rather than only this bump; the implementation MUST keep the bump a separately
revertable commit so it can be dropped if it is the sole failure.

#### Scenario: Gates run green with the bump in the bundle

- **WHEN** the four gates run after the v8 bump and module migration
- **THEN** all four exit 0
- **AND** if the bump is the sole gate failure, its commit can be reverted
  without unwinding the rest of the wave

## MODIFIED Requirements

### Requirement: The @bull-board Package Pair MUST Be On a Single Major

`@customreport/api` MUST declare `@bull-board/api` and `@bull-board/express` at
the same major version, and that major MUST be v8 (`^8.0.1`). The two packages
form a coupled runtime contract — `@bull-board/api`'s `createBullBoard` consumes
`@bull-board/express`'s `ExpressAdapter` — so a mixed-major install is forbidden
because it produces a runtime adapter mismatch.

#### Scenario: Declared versions share the v8 major

- **WHEN** `apps/api/package.json` is inspected after the upgrade
- **THEN** both `@bull-board/api` and `@bull-board/express` are pinned to a v8
  range (`^8.0.1`)
- **AND** the resolved lockfile contains a single 8.x line for the pair with no
  residual v7 copy

#### Scenario: A mixed-major install is rejected

- **WHEN** one of the two `@bull-board/*` packages is on v8 and the other is on
  v7
- **THEN** that state is treated as a defect and the change is not considered
  complete until both are on the same v8 major

## REMOVED Requirements

### Requirement: Deprecated Email Components Dependency MUST Have A Recorded Fallback Decision

**Reason**: The recorded reopening condition is now met — `react-email@6.x` is a
maintained successor that re-exports the imported component set, and every
scoped `@react-email/*` package is deprecated and frozen. The fallback decision
is replaced by the "Transactional Email MUST Track the Maintained react-email
Package" requirement above, which migrates off the deprecated pin.

**Migration**: Imports move from `@react-email/components` + `@react-email/render`
to `react-email` in the email renderer, the two templates, and the escalation
template test; rendered behavior is preserved and re-verified by
`render-template.test.ts` and a live Mailpit send.

### Requirement: Bull Board Mount Survives the v7 Migration Behaviorally Unchanged

**Reason**: Superseded by "Bull Board Mount Survives the v8 Migration
Behaviorally Unchanged" above; the behavioral invariant (mount at
`/admin/queues`, head-gated, lists the existing queues, unchanged wiring shape)
is unchanged — only the target major moves v7 → v8.

**Migration**: `bull-board.module.ts` migrates to the v8 import paths and call
shapes; the route, base path, queue construction, and auth middleware stay
byte-identical.

### Requirement: The v7 Bump MUST Pass All Gates Before Merge

**Reason**: Superseded by "The @bull-board v8 Bump MUST Pass All Gates" above.
The per-bump isolation clause is intentionally relaxed for this deliberately
bundled wave; the gate suite is unchanged and the bump stays a separately
revertable commit.

**Migration**: No behavioral change to the gate suite — `pnpm typecheck`,
`pnpm lint`, `pnpm test`, and `pnpm build` still all gate the bump; only the
isolation framing changes for this wave.
