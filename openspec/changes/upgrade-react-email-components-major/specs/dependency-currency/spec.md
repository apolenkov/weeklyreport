## ADDED Requirements

### Requirement: The Email Component Dependency MUST Be Off the Deprecated Release

The `apps/api` workspace MUST NOT depend on the deprecated
`@react-email/components@^1.0.12`; it MUST resolve to the registry-recommended
maintained successor (republished package, the `react-email` umbrella, or the
individual `@react-email/<component>` scoped packages), confirmed from the
actual deprecation notice before any code change. The swap MUST preserve the
rendered transactional-email behavior on the nodemailer path.

#### Scenario: Successor is identified before editing

- **WHEN** the change begins
- **THEN** the registry deprecation notice for `@react-email/components@1.0.12`
  is read and the recommended successor package is recorded
- **AND** that successor re-exports every component the templates import
  (`Html, Head, Preview, Tailwind, Body, Container, Heading, Text, Button,
Section`)

#### Scenario: No maintained successor exists

- **WHEN** the deprecation notice points at no successor that covers the
  imported component set
- **THEN** the change is blocked and the finding is reported to the user
- **AND** the deprecated `^1.0.12` pin is left in place as the safe fallback
  rather than forcing a half-working swap

#### Scenario: Email tests pass on the successor

- **WHEN** `pnpm --filter @customreport/api test` runs with the successor
  resolved in the lockfile
- **THEN** `render-template.test.ts` passes and `renderEmail` returns
  `{subject, html, text}` with both the HTML and plaintext multipart halves
  intact for the `deadline` and `escalation` kinds
- **AND** no test is skipped, quarantined, or deleted to achieve the green run

#### Scenario: Breaking changes are migrated, not masked

- **WHEN** the successor renames or removes a component, changes a prop, or
  alters `<Tailwind>` behavior used by the templates
- **THEN** the affected template in
  `apps/api/src/modules/email/templates/` is updated to the new API
- **AND** the fix addresses the cause rather than shimming around the removed
  or changed surface

#### Scenario: Render peer alignment is honored

- **WHEN** the successor's peer range requires a specific `@react-email/render`
  version
- **THEN** `@react-email/render` is bumped in lockstep within this change
- **AND** if no such requirement exists, `@react-email/render@^2.0.8` is left
  untouched to keep the change isolated

### Requirement: The react-email Upgrade MUST Remain Isolated

The replacement MUST change only the `@react-email/components` dependency, an
optionally-forced `@react-email/render` bump, and the files needed to make the
email templates render; it MUST NOT bundle unrelated dependency upgrades, so a
failed validation can be rejected without affecting other work. The merge
decision is the user's.

#### Scenario: No unrelated dependency moves with the bump

- **WHEN** the change is prepared for review
- **THEN** the diff touches only `apps/api/package.json` (the
  `@react-email/components` entry plus any forced `@react-email/render` change),
  `pnpm-lock.yaml`, and the email template / renderer files under
  `apps/api/src/modules/email/`
- **AND** no other major or minor dependency version is changed in the same
  change

#### Scenario: All repo gates pass before handing off the merge decision

- **WHEN** the upgrade is complete
- **THEN** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `pnpm lint:md` all exit 0
- **AND** the confirmed successor and version, breaking changes encountered, and
  files touched are reported to the user for the merge decision
