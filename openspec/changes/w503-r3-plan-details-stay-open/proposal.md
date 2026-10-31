# Proposal

## Why

Round-4 acceptance (C4897): in the plan outcome composer, the "Parent and
stages" `<details>` is controlled by `open={parent.kind === "unresolved"}`. When
the lead picks a Parent from the unresolved state, `open` flips to false, React
closes the section and hides the required stage selection that has just appeared.

## What Changes

- The "Parent and stages" section opens once if the parent is unresolved when
  the composer mounts, and afterwards follows the user's own open/close choice.
  Picking a Parent never collapses it.

## Capabilities

### Modified Capabilities

- `lead-plan-verdict`: adds the requirement that the composer parent section stays open after choosing a Parent.

## Impact

- `apps/web/src/features/report-pages/ui/lead/shell/overview-plan-composer-fields.tsx` and `overview-plan-composer.test.tsx`.

## Non-goals

- No change to parent or stage validation.
