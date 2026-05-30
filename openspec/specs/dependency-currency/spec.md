# dependency-currency Specification

## Purpose

Records deliberate dependency-currency decisions where a package cannot simply
be kept on `latest` — specifically deprecated dependencies retained as a
recorded fallback because no maintained successor exists. Keeps the "why we are
knowingly on a deprecated pin" reasoning durable and revisitable, rather than
re-litigating it every audit.

## Requirements

### Requirement: Deprecated Email Components Dependency MUST Have A Recorded Fallback Decision

The `apps/api` workspace MUST retain `@react-email/components@^1.0.12` as a deliberate, recorded fallback for as long as the registry exposes no maintained successor that re-exports the component set its transactional-email templates import, rather than forcing a half-working swap. The retention MUST be revisited when a maintained successor ships, and the rendered transactional-email behavior MUST stay guarded by `render-template.test.ts`.

#### Scenario: No maintained successor exists at decision time

- **WHEN** the deprecation of `@react-email/components@1.0.12` is investigated against the registry
- **THEN** the notice is the generic "Package no longer supported" boilerplate applied across the whole version line, `1.0.12` is the latest published version, and no republished package, no `@react-email/<component>` scoped set, and no `react-email` umbrella export covers the imported components (`Html, Head, Preview, Tailwind, Body, Container, Heading, Text, Button, Section`)
- **AND** the `^1.0.12` pin is left in place as the safe fallback with the finding recorded for the user

#### Scenario: The companion renderer is not dragged along

- **WHEN** the fallback decision is recorded
- **THEN** `@react-email/render@^2.0.8` is left untouched because it is not deprecated and the components retention does not force a coordinated bump

#### Scenario: Behavior stays guarded while on the fallback

- **WHEN** `pnpm --filter @customreport/api test` runs
- **THEN** `render-template.test.ts` passes and `renderEmail` returns `{subject, html, text}` with both the HTML and plaintext multipart halves intact for the `deadline` and `escalation` kinds
- **AND** no test is skipped, quarantined, or deleted to mask a regression

#### Scenario: A maintained successor reopens the upgrade

- **WHEN** a maintained successor that re-exports the imported component set is published
- **THEN** the retention decision is revisited and the migration is reproposed as an isolated change
- **AND** that migration changes only `@react-email/components`, an optionally-forced `@react-email/render` bump, `pnpm-lock.yaml`, and the email template/renderer files under `apps/api/src/modules/email/`, with no unrelated dependency moving alongside it
