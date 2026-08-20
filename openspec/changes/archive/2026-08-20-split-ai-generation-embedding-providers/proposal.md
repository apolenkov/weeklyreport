## Why

Administrators currently have to use one provider connection and credential for planner, answer, and embedding models, so a valid pairing such as OpenAI or Groq for generation with Mistral or Jina for embeddings cannot be configured. The single-connection constraint is visible in the current provider contract and lifecycle design (`packages/shared/src/schemas/`, `prisma/schema.prisma`, and `openspec/changes/refine-ai-provider-settings-lifecycle/design.md`).

## What Changes

- Replace the single provider connection inside each immutable AI configuration revision with an atomic composite of a generation connection and an embedding connection.
- Keep planner and answer on one generation connection while allowing separate model IDs; allow embeddings either to reuse that connection or use a separate profile, endpoint, credential, and model.
- Make provider profiles role-aware so the universal settings form offers only generation-capable profiles for generation and embedding-capable profiles for embeddings, including the intended OpenAI/Groq and Mistral/Jina combinations.
- Split capability testing and compatibility identities by connection, while requiring passing evidence for the complete composite revision before activation.
- Preserve the active revision during embedding-scope preparation and switch the complete tested configuration atomically.
- Avoid duplicate secrets when embeddings reuse the generation connection, and preserve masked, encrypted credential handling for both independent connections.
- Migrate existing revisions to the reuse-generation mode using MVP schema-reset freedom; no runtime fallback or silent provider default is introduced.

Non-goals:

- Selecting different providers for planner and answer.
- Automatic provider failover, load balancing, or routing controls.
- Runtime fallback from a failed embedding connection to the generation connection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-provider-configuration`: define composite revisions, role-aware profiles, connection-scoped tests, credentials, and atomic activation.
- `admin-settings-ui`: expose generation and embedding connection sections in one universal provider form.
- `ai-prompt-management`: bind prompt compatibility to the generation identity rather than the embedding choice.
- `lead-report-assistant`: resolve one composite runtime snapshot and route generation and embedding calls to their respective connections.
- `semantic-embedding-cache`: derive embedding scope and preparation only from the embedding connection.

## Impact

This changes shared AI schemas and tRPC contracts, Prisma configuration and test-evidence records, encrypted credential storage, provider-profile metadata, runtime transport resolution, capability-test orchestration, semantic indexing, activation logic, and the Settings AI workspace. It depends on `refine-ai-provider-settings-lifecycle` landing first because it extends that change's revision, evaluation, and asynchronous-test model.
