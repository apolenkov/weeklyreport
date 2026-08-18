## 1. Shared Contracts and Persistence

- [x] 1.1 Add the catalog-owned serving-contract identity and legacy/incompatible read state to the shared AI prompt schemas and read models.
- [x] 1.2 Add the serving-contract identity to `AiPromptBundleRevision` persistence with an additive Prisma migration and update repository selects/mappers/commands.
- [x] 1.3 Add repository tests proving current revisions inherit the identity, legacy revisions remain readable, and legacy revisions cannot be selected as serving candidates.

## 2. API Prompt Control Plane and Runtime

- [x] 2.1 Keep the AI feature catalog/composer responsible for slots, schemas, versions, limits, and composition while persisted revisions provide complete prompt text.
- [x] 2.2 Make the system-authored handoff import the exact four current code prompts, verify every slot and the canonical hash, and activate the idempotent baseline directly without provider or LLM calls.
- [x] 2.3 Change prompt activation and restore to require only current serving identity, structural composition, content hash, and lifecycle; remove provider/evaluation prerequisites.
- [x] 2.4 Remove the evaluation lookup from runtime availability and prompt-backed snapshot resolution; retain provider-only embedding resolution and current client-cache separation.
- [x] 2.5 Keep admin lifecycle operations, audit, metrics, and tests safe for direct current-contract activation and inspection-only legacy history.

## 3. Web Prompt Editor

- [x] 3.1 Show the current serving identity, active serving revision, and legacy/incompatible status while retaining full prompt-text editing and immutable history.
- [x] 3.2 Remove the Evaluate action and evaluation prerequisite; allow current-contract saved drafts and restores to activate directly without changing the Lead Chat surface.
- [x] 3.3 Add/update component and settings-flow tests for baseline/current/legacy states, direct activation, disabled legacy actions, and active-version display.

## 4. Handoff and Verification

- [x] 4.1 Run the idempotent handoff against the disposable development database and verify the imported bundle matches every current prompt slot and the canonical hash.
- [x] 4.2 Verify the active runtime snapshot and editor lifecycle with mocked database/provider fixtures; do not send provider or prompt-evaluation requests.
- [x] 4.3 Remove compiled prompt constants from runtime resolution while retaining only the one-time import fixture for controlled provisioning.
- [x] 4.4 Run `pnpm typecheck`.
- [x] 4.5 Run `pnpm lint`.
- [x] 4.6 Run `pnpm test`.
- [x] 4.7 Run `pnpm build`.
- [x] 4.8 Run `pnpm lint:md` and review `openspec status --change migrate-report-assistant-prompts-to-editor`.
