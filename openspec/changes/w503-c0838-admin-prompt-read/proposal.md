# Proposal

## Why

An administrator can receive one prompt revision as active in the active bundle and superseded in history when another administrator activates a candidate between the two reads. TASK-503 / C0838 requires a coherent administrative response rather than a mixture of committed states.

## What Changes

- Read the feature control, included active revision, latest revision and bounded history from one repeatable-read snapshot.
- Add an explicit administrative read contract, separate from the existing runtime provider/prompt snapshot contract.
- Reproduce the activation interleaving through the real PostgreSQL repository and public `AiPromptService.read` payload.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-prompt-management`: administrative prompt reads expose a coherent snapshot even across concurrent activation.

## Impact

`apps/api/src/modules/ai-prompts/infrastructure/ai-prompt.repository.ts` and its existing integration test. The consumer is `AiPromptService.readEntry`, which maps repository revisions to the `admin.aiPrompts` response. Source inventories and advice are in `~/work/handoffs/task-503/wave-08/{WAVE-INPUT.json,ai-facts.json,ADVICE-C2813-C0838-ASTRA.md}`. The owning current spec is `openspec/specs/ai-prompt-management/spec.md`.

## Non-goals

- No equality requirement between active and latest revisions; newer drafts remain valid.
- No requirement that the active revision appears in every bounded history window.
- No locks, retries, write-path changes, provider/runtime changes, schema changes or new dependencies.
- No browser acceptance claim; native execution, full gates, independent review and delivery belong to the coordinator.
