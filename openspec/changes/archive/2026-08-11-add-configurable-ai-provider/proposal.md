## Why

Administrators cannot currently choose the AI service used by CustomReport: the API boots with a Mistral-only configuration, while the Settings → Integrations AI card remains inert. The product needs one organization-wide, admin-managed integration that can use Mistral, OpenRouter, or an approved corporate OpenAI-compatible endpoint without changing application code.

The current coupling is visible in `apps/api/src/modules/search/search.module.ts`, the Mistral infrastructure adapters, `apps/web/src/features/organization/ui/settings-integrations-sub-tab.tsx`, and the Mistral-specific requirements under `openspec/specs/lead-report-assistant`, `semantic-embedding-cache`, and `lead-assistant-provider-resilience`.

## What Changes

- Replace the Coming Soon AI card with an admin-only configuration workflow for provider, credential, planner model, answer model, and embedding model. The system measures embedding dimensions during capability testing.
- Support built-in Mistral and OpenRouter profiles plus a deployment-approved custom OpenAI-compatible endpoint.
- Store credentials encrypted and masked; never return or log plaintext secrets.
- Test a draft configuration's required capabilities before activation and keep exactly one global active configuration for every product user and background worker.
- Stage embedding-scope changes: build and expose progress for the new cache before atomic activation, while the old configuration remains active.
- Preserve explicit `provider_unavailable` behavior; do not automatically fail over to another provider.
- Import the existing Mistral deployment configuration once during rollout so the currently working assistant is not disabled.
- Use the MVP freedom to reshape the singleton configuration schema and the single init migration directly.

### Non-goals

- Per-user, per-role, or per-feature provider selection.
- Automatic cross-provider failover or cost-based routing.
- Supporting arbitrary non-OpenAI-compatible protocols in the first release.
- Allowing an administrator to bypass the deployment endpoint allowlist.

## Capabilities

### New Capabilities

- `ai-provider-configuration`: Admin-only global AI configuration, encrypted credentials, approved custom endpoints, capability testing, staged activation, status, and audit behavior.

### Modified Capabilities

- `lead-report-assistant`: Replace Mistral-specific planner and answer requirements with capability-based provider contracts and define the unconfigured state.
- `semantic-embedding-cache`: Resolve cache scope from the active configuration and stage reindexing before embedding-scope activation.
- `lead-assistant-provider-resilience`: Normalize supported-provider failures without automatic fallback.

## Impact

This affects shared schemas and tRPC contracts, the admin settings API and Integrations UI, Prisma configuration storage and seed/bootstrap logic, search-module provider wiring, Mistral adapters, new OpenAI-compatible transport/profile infrastructure, BullMQ semantic-index jobs, metrics/audit logs, environment validation, tests, and the existing assistant specifications. An encryption master key and explicit allowed provider origins become required deployment configuration.
