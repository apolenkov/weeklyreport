# Proposal

## Why

Text containing only a word joiner or soft hyphen passes shared visible-content validation. TASK-503.104 addresses this shared primitive gap while preserving visible multilingual text; C3679 and TASK-503.45 retain their separate catalog-label residuals.

## What Changes

- Extend the existing invisible-only predicate to the selected U+00AD, U+034F, U+180E and U+2060–U+2064 characters.
- Keep successful text byte-for-byte unchanged, including combining marks, joiners and formatting characters around visible text.
- Extend the primary `report.invisible-text.test.ts` table and verify the shared stage-name boundary and existing caller suites.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `schema-conventions`: define the selected invisible-only rejection boundary and unchanged successful text.

## Impact

The owner is `packages/shared/src/schemas/primitives/report-primitives.schema.ts`. Its predicate also validates stage-name arrays. Consumers include report prose/outcomes, review comments, activity names/Jira accounts, search and assistant inputs. Read schemas using the same validators also reject newly covered invisible-only values. No dependency or storage migration is required.

## Non-goals

- Changing Admin/SAML schemas that bypass `safeText`, cleaning stored values, or closing whole C3679.
- Trimming, normalizing, stripping accepted strings, or rejecting all Unicode combining/format characters.
- Changing text length limits, error messages, authorization or report lifecycle behavior.
