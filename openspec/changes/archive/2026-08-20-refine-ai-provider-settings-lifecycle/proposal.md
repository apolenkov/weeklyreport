## Why

AI administration is split between a provider form under Settings → Integrations
and report-assistant prompts compiled into API code. With two more AI features
planned next, administrators need one scalable workspace for provider health,
feature configuration, and safely editable prompt behavior. The current seams are
`settings-tab.tsx`, `ai-provider-card.tsx`, `ai-runtime.resolver.ts`, and
`report-assistant.prompt-text.ts`.

## What Changes

- Preserve the partially implemented compact provider disclosure and the safe
  discard operation for unusable provider attempts.
- Add a dedicated Settings → AI area with Overview, Provider, and Features
  navigation; move the live provider control out of Integrations.
- Introduce a code-registered feature catalog and feature-scoped immutable prompt
  bundles. Report Assistant starts with planner, planner-repair, answer, and
  citation-repair slots.
- Allow an administrator to replace the complete text of each versioned prompt;
  immutable revisions, exact-pair evaluation, and activation gates protect the
  serving configuration rather than a read-only prompt fragment.
- Require synthetic evaluation against the exact active provider before prompt
  activation, and recheck the pair during the atomic pointer swap.
- Run provider and prompt compatibility evaluation as durable asynchronous work,
  use deterministic rate-safe probes, and distinguish transient inconclusive runs
  from proven incompatibility instead of holding an HTTP mutation open.
- Add one provider-level reasoning configuration with **Provider default**, **Off**,
  and a provider-specific **Custom** text value, prove the exact configuration
  during capability testing, and persist the tested answer protocol selected
  between strict JSON Schema output and a forced answer tool.
- Bootstrap the current report-assistant v1 prompts as the first active bundle,
  resolve one provider-plus-prompt snapshot per request, and retain explicit
  restore and safe discard behavior without a runtime fallback to code text.
- Update OpenSpec, LLM architecture/contracts/runbooks, admin documentation,
  tests, and rollout guidance with the new source of truth.

### Non-goals

- Implementing the next two AI product features in this change.
- Per-user prompts, A/B routing, automatic provider failover, or arbitrary
  admin-created feature keys.
- Provider-routing controls such as price, throughput, Nitro, or Exacto selection;
  endpoint routing remains provider-owned.
- Allowing administrators to add slots, feature keys, tools, schemas, or runtime
  controls through prompt editing.
- Persisting report questions, evidence, generated answers, or conversation
  history.

## Capabilities

### New Capabilities

- `ai-prompt-management`: Feature registration, locked-core composition, immutable
  revisions, evaluation, activation, restore, discard, audit, and bootstrap.

### Modified Capabilities

- `admin-settings-ui`: Add the dedicated AI workspace, move provider management,
  and expose feature-level prompt/version workflows.
- `ai-provider-configuration`: Preserve safe provider-attempt discard and require
  compatibility with active feature prompt bundles during provider testing and
  activation.
- `lead-report-assistant`: Resolve one active report-assistant prompt bundle with
  the provider snapshot and fail closed when that feature is not configured.

## Impact

This affects shared contracts, Prisma provider/prompt/control/evaluation storage,
AI-provider and search modules, runtime/adapters, admin Settings, audit/telemetry,
bootstrap, tests, E2E catalog coverage, and `docs/llm-report/`. The project is
pre-production, so the init migration and disposable dev/test/UAT databases may be
reshaped under the existing destructive guard.
