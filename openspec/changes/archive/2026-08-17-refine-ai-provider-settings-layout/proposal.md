## Why

The `Settings → AI → Provider` surface is functionally complete, but its nested
surfaces and generous spacing make the configuration harder to scan and waste
vertical space on the settings page. The desktop Settings tab strip can also
acquire vertical overflow, even though it should remain a horizontally
scrollable tab strip when space is limited.

## What Changes

- Refine only the `Settings → AI → Provider` layout: reduce nested-card chrome,
  tighten the header and spacing, and group Generation and Embeddings into a
  clearer responsive composition.
- Keep every currently live provider and embedding field, lifecycle action,
  capability result, and diagnostic detail available; preserve their existing
  payloads and behavior.
- Make the outer Settings `TabsList` constrain vertical overflow and allow
  horizontal overflow only when needed, without changing tab navigation.
- Update focused Provider and Settings tab UI tests for the new structure and
  overflow behavior.

## Non-goals

- No changes to `Settings → AI → Features` or prompt-editor behavior.
- No changes to Integrations, Holidays, other Settings tabs, AI runtime
  resolution, API contracts, persistence, or provider lifecycle semantics.

## Capabilities

### New Capabilities

- `ai-provider-settings-layout`: Defines the compact, responsive presentation
  of the AI Provider configuration and the horizontal-only overflow behavior of
  the outer Settings tab strip.

### Modified Capabilities

- None. The existing `ai-provider-configuration` and `admin-settings-ui`
  requirements remain behaviorally unchanged; this change records a visual
  refinement only.

## Impact

- Frontend UI in `apps/web/src/features/organization/ui/ai-provider-*.tsx` and
  `apps/web/src/features/admin/ui/settings-tab.tsx`.
- Focused frontend tests for the Provider card and Settings tab strip.
- No backend, shared schema, database, or dependency changes.
