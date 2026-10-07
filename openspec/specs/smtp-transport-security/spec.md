# smtp-transport-security Specification

## Purpose

Requires the production SMTP transport to enforce TLS (secure/requireTLS) rather than sending mail in cleartext.

## Requirements

### Requirement: Production SMTP transport enforces TLS

The production email transport MUST derive the nodemailer `secure` option
from the configured SMTP port (`secure: true` when the port is `465`,
`false` otherwise) rather than hardcoding it. The transport MUST set
`requireTLS: true` whenever SMTP authentication is configured, so a failed
STARTTLS upgrade aborts the send instead of falling back to a cleartext
`AUTH LOGIN` exchange.

#### Scenario: Port 465 uses implicit TLS

- **GIVEN** `SMTP_PORT` is configured as `465`
- **WHEN** `EmailService` builds its production transporter
- **THEN** the transporter is constructed with `secure: true`

#### Scenario: Port 587 uses STARTTLS, not implicit TLS

- **GIVEN** `SMTP_PORT` is configured as `587` (or unset, defaulting to 587)
- **WHEN** `EmailService` builds its production transporter
- **THEN** the transporter is constructed with `secure: false`
- **AND** `requireTLS: true` is set because `SMTP_USER` is configured

#### Scenario: A relay that cannot upgrade to TLS fails loud, not silently in cleartext

- **GIVEN** SMTP authentication is configured (`SMTP_USER` set)
- **WHEN** the configured relay does not offer STARTTLS
- **THEN** the send fails with a TLS-upgrade error
- **AND** no `AUTH LOGIN` credentials are transmitted in cleartext

### Requirement: SMTP auth credentials are an all-or-none pair

`SMTP_USER` and `SMTP_PASS` are optional as a pair, not independently. The
environment schema MUST reject a configuration where exactly one of them is
present or non-blank, in every `NODE_ENV`, so an anonymous relay stays
supported and a half-configured pair fails at startup instead of surfacing as
a late send failure or silently ignored password.

#### Scenario: User without password is rejected at boot

- **GIVEN** `SMTP_USER` is set but `SMTP_PASS` is absent or blank
- **WHEN** the environment is validated
- **THEN** validation fails with an issue naming the missing counterpart

#### Scenario: Anonymous relay stays supported

- **GIVEN** neither `SMTP_USER` nor `SMTP_PASS` is set
- **WHEN** the environment is validated
- **THEN** validation does not fail on the SMTP auth pair
