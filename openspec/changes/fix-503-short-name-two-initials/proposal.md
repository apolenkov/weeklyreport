# Proposal

## Why

C3519: `shortNameFromName` turned every token after the surname into an initial,
so "Петров Алексей Иван Дмитрий Павел" became "Петров А.И.Д.П." while the short
form everywhere else is "Фамилия И.О.". The contract describes the short form
only for structured parts and says nothing about a plain string of four or more
tokens, so the limit is a product decision (coordinator, 2026-10-13).

## What Changes

- A plain-string short form takes the surname plus the initials of at most the
  first two following tokens, the same "first and second token" rule as the
  initials fallback.
- Compound given names in a plain string are not recognized; structured parts
  remain the exact source ("Иванова А.П.").

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `structured-user-name`: short form from a plain name.

## Impact

`packages/shared/src/name/user-name.ts` and its test. No consumer changes.

## Non-goals

- Building the short form from parts on the server (the cross-author derive
  paths build `authorShortName` from the plain name) and a short-form contract
  for SAML stubs are separate follow-ups.
