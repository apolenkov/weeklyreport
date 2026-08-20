## Why

Settings → AI offers Groq generation and Jina embeddings, but the checked-in non-production allowlist rejects both built-in endpoints. When that draft save fails, the Provider card hides the operation error behind an older capability-test message, so the administrator sees the wrong cause and cannot save a supported configuration.

## What Changes

- Add the fixed Groq and Jina origins to the explicit development and example deployment allowlists used by supported built-in profiles.
- Make feedback from the current provider operation take precedence over historical execution feedback.
- Preserve historical capability and compatibility results as separate detail rather than presenting them as the result of a new save attempt.
- Add regression coverage for a failed draft save when the observed revision has an older failed test.

### Non-goals

- Changing capability probes, prompt compatibility evaluation, or activation gates.
- Sending credentials or synthetic provider requests during draft save.
- Weakening origin validation for custom endpoints.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-provider-configuration`: supported built-in Groq and Jina profiles have deployment origins that can be explicitly enabled in the checked-in non-production configuration.
- `admin-settings-ui`: current operation feedback is not masked by historical provider execution status.

## Impact

Affected areas are `.env` examples, provider configuration documentation, and the Settings → AI Provider feedback component/tests. The tRPC contract, credential handling, database schema, and runtime routing remain unchanged. This follows the current provider profile inventory in `apps/api/src/modules/ai-provider/domain/provider-profile.ts` and the AI workspace requirements in `openspec/specs/`.
