## 1. Existing Provider Lifecycle Contract and API Slice

- [x] 1.1 Add the revision-ID discard input and success output to
      `packages/shared/src/schemas/ai-provider-configuration.ts`, with schema tests
      for valid and invalid IDs.
- [x] 1.2 Add `discard` to
      `apps/api/src/infrastructure/trpc/routers/admin/ai-provider.procedures.ts`
      using the canonical admin middleware chain, and cover role rejection plus
      input/output behavior.
- [x] 1.3 Add an application-service discard operation that rechecks lifecycle
      eligibility, maps missing/protected revisions to controlled configuration
      errors, and records the safe audit transition.
- [x] 1.4 Complete and verify the conditional repository delete that accepts
      only `draft` and `failed` rows, including successful, missing, protected, and
      concurrent-lifecycle outcomes in repository/service tests.

## 2. Existing Provider Administration UI Slice

- [x] 2.1 Extract an accessible AI-provider disclosure header/summary from
      `apps/web/src/features/organization/ui/ai-provider-card.tsx`, keeping
      availability and active provider/model visible without credentials.
- [x] 2.2 Implement initial expansion rules and session-local explicit-toggle
      precedence for stable, unconfigured, draft, failed, preparing, and
      mutation-error states.
- [x] 2.3 Extend
      `apps/web/src/features/organization/ui/ai-provider-mutations.ts` with the
      discard mutation, pending state, safe error handling, and control-query
      refresh.
- [x] 2.4 Update
      `apps/web/src/features/organization/ui/ai-provider-retained-revisions.tsx`
      to distinguish disposable attempts from retained rollback revisions, with
      confirmed discard only for `draft` and `failed` rows.
- [x] 2.5 Complete focused component tests for disclosure accessibility/state,
      safe compact summaries, discard confirmation/pending/error handling, and
      protected lifecycle action visibility.

## 3. Existing Provider Lifecycle Slice Verification

- [x] 3.1 Add end-to-end or PostgreSQL-backed integration coverage proving an
      administrator can discard a failed attempt while a superseded revision
      remains restorable and an active configuration is unchanged.
- [x] 3.2 Run focused shared, API, and web tests for the existing disclosure and
      provider-discard slice before relocating the provider UI; record exact
      commands and results.

## 4. Shared Prompt Contracts and Prisma Model

- [x] 4.1 Add strict shared schemas/types for registered AI feature keys, prompt
      slots, locked/editable/effective prompt reads, draft writes, bundle lifecycle,
      evaluation results, feature controls, availability, activation, restore, and
      discard, with explicit safe-text and size limits and no defaults.
- [x] 4.2 Add shared contract tests covering unknown fields, attempts to mutate
      locked/catalog-owned fields, required slots, limits, lifecycle shapes,
      redacted evaluation data, and strict feature-key validation.
- [x] 4.3 Add Prisma enums/models for `AiPromptBundleRevision`,
      `AiFeaturePromptControl`, and `AiPromptEvaluation`, including feature-local
      revision identity, active-pointer relations, immutable content snapshots,
      compatibility identity, lifecycle indexes, and safe audit timestamps.
- [x] 4.4 Update `prisma/schema.prisma`, the single init migration, seeds, and
      database fixtures for empty, bootstrapped-active, draft, validated, failed,
      superseded, restored, and concurrent revision states; retain the production
      destructive guard and document the additive-migration contingency.
- [x] 4.5 Run `pnpm --filter @customreport/api db:generate` and add Prisma model,
      constraint, relation, and reset/seed coverage before API implementation.

## 5. API Prompt Catalog and Control Plane

- [x] 5.1 Implement a typed `AiFeaturePromptCatalog` with the
      `lead-report-assistant` feature, four required slots, versioned locked-core
      snapshots, editable schemas, deterministic composition, content hashing, and
      evaluator metadata.
- [x] 5.2 Extract the current v1 prompt behavior into catalog-owned locked and
      editable layers while keeping generated tool/answer schemas and message-data
      boundaries outside administrator control; add golden composition tests proving
      the baseline effective prompts are unchanged.
- [x] 5.3 Implement a prompt repository with parsed feature-control reads,
      concurrency-safe feature-local revision creation, exact revision/evaluation
      lookup, conditional lifecycle transitions, and one atomic active-pointer swap.
- [x] 5.4 Implement prompt read/draft services that reject unregistered features,
      unknown slots, locked-field writes, invalid bases, oversized content, and
      mutable updates to existing revisions.
- [x] 5.5 Implement feature-specific synthetic evaluation and durable safe result
      recording keyed by prompt revision, provider revision, content hash, contract
      version, and evaluator version without product data or provider bodies.
- [x] 5.6 Implement atomic prompt activation, current-evaluation rechecks,
      supersession, re-evaluated restore, and lifecycle-conditional discard while
      leaving provider and embedding pointers unchanged on every failure.
- [x] 5.7 Add `admin.aiPrompts` read, draft, evaluate, activate, restore, and
      discard procedures through the canonical `adminProcedure`, with role-coverage,
      non-admin denial, strict boundary parsing, concurrency, and safe error tests.
- [x] 5.8 Add bounded prompt lifecycle metrics and safe audit events for draft,
      evaluation, activation, restore, discard, and bootstrap; regression-test that
      prompts, report/provider payloads, credentials, revision IDs, and hashes never
      enter metric labels or unsafe logs.

## 6. Provider Compatibility and Runtime Resolution

- [x] 6.1 Parameterize planner/repair and answer/repair prompt builders and
      OpenAI-compatible adapters with an immutable composed prompt set instead of
      importing runtime text constants; preserve forced tools, strict schemas,
      disabled parallel calls, repair bounds, and untrusted data separation.
- [x] 6.2 Add a deep runtime-configuration repository that reads the enabled
      active provider and one feature's active prompt bundle under a repeatable
      database snapshot and validates both through domain types.
- [x] 6.3 Extend `AiRuntimeSnapshot` with feature/prompt identity and composed
      prompts, cache prompt-aware runtime objects by provider-plus-prompt identity,
      and keep exact provider resolution for embedding workers independent of prompt
      state.
- [x] 6.4 Refactor `ReportAssistantService` and its availability seam to acquire
      exactly one `lead-report-assistant` provider-plus-prompt snapshot per request,
      use it for both repair paths, and return `ai_not_configured` before retrieval
      when the pair is absent or incompatible.
- [x] 6.5 Extend provider capability testing with every active registered
      feature's synthetic prompt evaluator and persist bounded compatibility results
      for the exact candidate-provider/active-prompt identities.
- [x] 6.6 Recheck active prompt pointers, hashes, contract versions, and evaluator
      versions during provider activation so stale/failing compatibility keeps the
      previous provider active and never starts embedding preparation.
- [x] 6.7 Implement and test the idempotent report-assistant prompt bootstrap,
      integrate it with existing environment rollout/seed orchestration, and remove
      compiled prompt text as a runtime fallback only after every environment has a
      valid active baseline bundle.
- [x] 6.8 Add unit and PostgreSQL integration coverage for activation races,
      provider changes after prompt evaluation, prompt changes after provider tests,
      in-flight request snapshot stability, restore compatibility, missing/corrupt
      prompt state, multi-instance visibility, and embedding-worker independence.

## 7. Dedicated AI Settings Workspace

- [x] 7.1 Add the Settings **AI** sub-tab and responsive local Overview,
      Provider, and Features navigation using existing Settings patterns and English
      UI strings; keep selection client-side and accessible.
- [x] 7.2 Move the existing `AiProviderCard` into AI → Provider without losing
      its completed disclosure/discard behavior, remove provider controls from
      Integrations, and update Integrations to show only external roadmapped services.
- [x] 7.3 Build AI Overview from safe admin read models, showing global provider
      availability and registered feature readiness without credentials, prompt
      bodies, or unimplemented feature controls.
- [x] 7.4 Build the registered Features list and Report Assistant detail surface
      with active version/provider compatibility, four slot editors, visibly locked
      core, editable behavioral instructions, and complete effective-prompt preview.
- [x] 7.5 Add immutable version history and active-versus-candidate diff without
      using durable browser storage or exposing hidden provider/prompt data.
- [x] 7.6 Add draft, evaluation, activation, restore, and discard actions with
      confirmations, lifecycle-specific availability, pending conflict prevention,
      safe success/error states, and query refresh that does not clobber unsaved edits.
- [x] 7.7 Add Testing Library coverage for Settings/AI navigation, provider
      relocation, mobile/keyboard behavior, locked-field immutability, effective
      preview/diff, version history, stale evaluation, lifecycle actions, and safe
      error handling with zero React console errors.
- [x] 7.8 Update the E2E catalog if route/surface discovery changes and add an
      admin integration scenario covering Overview, provider lifecycle, prompt draft,
      evaluation, activation, restore/discard, and unchanged Lead feature availability.

## 8. Documentation and Rollout

- [x] 8.1 Rewrite
      `docs/llm-report/lead-report-assistant-prompt-contract.md` to define catalog
      slots, locked-core/editable composition, durable versions, exact pair
      evaluation, bootstrap, activation/restore, and the database runtime source of
      truth while preserving every security and evidence invariant.
- [x] 8.2 Update `docs/llm-report/README.md`, decision summary,
      `architecture.mmd`, and `logical-flow.mmd` for Settings → AI, feature-scoped
      prompt controls, provider/prompt snapshots, evaluation, and fail-closed outcomes.
- [x] 8.3 Update the assistant rollout, provider integration, pgvector guidance,
      deployment examples, environment/bootstrap instructions, operational checks,
      and rollback procedure; remove stale wording that locates active AI management
      under Integrations or identifies code constants as runtime prompt truth.
- [x] 8.4 Review `docs/README.md`, root README/onboarding references, OpenSpec
      durable specs, E2E catalog documentation, and any runbook links so the new AI
      workspace and prompt lifecycle have one coherent discoverable documentation
      path.
- [x] 8.5 Reconcile the missing documented `pnpm lint:md` script by adding a
      project-local Markdown lint command/configuration or correcting the
      authoritative gate instructions, then run the chosen Markdown and
      link/diagram checks; verify no session artifacts or generated evaluation dumps
      enter `docs/` and archive diagnostics under the configured external archive.

## 9. Final Verification

- [x] 9.1 Run focused shared-schema, prompt catalog/composer, provider/prompt
      service, repository, runtime, adapter, telemetry, admin-router, and web component
      Vitest suites; record exact commands and results.
- [x] 9.2 Run PostgreSQL integration tests and
      `pnpm test:e2e:integration` against a database distinct from `DATABASE_URL`,
      covering bootstrap, concurrent activation, availability, and admin workflows.
- [x] 9.3 Run `pnpm catalog:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
      `pnpm build`, and the reconciled Markdown gate; record exact results and any
      approved environment-dependent exception before marking the change complete.
- [x] 9.4 Review every changed write path against `ai-prompt-management`,
      `ai-provider-configuration`, `lead-report-assistant`, and `admin-settings-ui`;
      verify the canonical role chains, period dual-state, report-write independence,
      destructive guard, no-fallback rule, English TSX strings, prompt privacy, and
      absence of new lint exemptions.

## 10. Full-Prompt Editing Refinement

- [x] 10.1 Change prompt composition and bootstrap behavior so each saved slot
      contains the complete administrator-editable prompt text, while preserving
      immutable revisions, exact-pair evaluation, and code-owned structural controls.
- [x] 10.2 Replace the always-visible four-editor UI with an accessible collapsed
      prompt list whose individual prompts reveal their full editor on demand.
- [x] 10.3 Update OpenSpec requirements and focused catalog/UI coverage for complete
      prompt editing and compact disclosure behavior.

## 11. Reasoning and Answer-Protocol Compatibility Refinement

- [x] 11.1 Extend strict shared provider draft/read contracts and Prisma provider
      revisions with one reasoning configuration (`provider_default`, `off`, or
      `custom` plus a required non-empty text value of at most 64 characters) and a
      nullable tested answer
      protocol (`json_schema`, `forced_tool`); update the init migration, seeds,
      repository projections, and schema/Prisma coverage without raw request JSON or
      silent defaults.
- [x] 11.2 Add the single universal Reasoning control with Provider default, Off,
      and Custom text value to AI → Provider; retain its selected value across
      draft/test failure and refetch, keep answer protocol read-only or hidden, and
      add no provider-routing controls; cover accessibility, pending/error states,
      English UI strings, and narrow layouts.
- [x] 11.3 Extend the OpenAI-compatible transport and runtime configuration seam to
      apply the specified profile mapping: omit reasoning for `provider_default`,
      send OpenRouter through `reasoning.effort`, and send Mistral/custom
      OpenAI-compatible through `reasoning_effort`; apply `none` for Off or the exact
      Custom text value consistently to planner, planner-repair, answer, and
      citation-repair without arbitrary request options.
- [x] 11.4 Implement bounded answer-protocol capability negotiation: probe strict
      JSON Schema first, try one forced side-effect-free answer tool only after a
      classified protocol incompatibility, never negotiate on auth/rate-limit/
      timeout/transport/provider failures, and validate both payloads through the
      same answer schema.
- [x] 11.5 Persist the selected answer protocol and bounded reasoning/protocol
      failure codes in the candidate revision; include them in generic/feature
      compatibility identity and activation/restore rechecks without credentials,
      provider bodies, prompts, or unbounded metric labels.
- [x] 11.6 Update planner/answer adapters, prompt synthetic evaluation, runtime
      snapshots, and cache identity to use only the persisted reasoning
      configuration (including its exact Custom value) and answer protocol, force
      exactly one named answer tool when selected, and prove that runtime never falls
      back to the alternate protocol.
- [x] 11.7 Add focused unit and PostgreSQL integration coverage for provider-default
      omission, profile-specific Off/Custom wire mapping, invalid custom values,
      planner-versus-answer rejection, JSON Schema success, forced-tool selection,
      malformed/multiple/wrong tool calls, transient failures without negotiation,
      stale compatibility, restore, and immutable in-flight snapshots; update
      provider integration/rollout docs
      before rerunning every reopened and pending final gate.

## 12. Durable and Deterministic Compatibility Evaluation

- [x] 12.1 Extend shared contracts, Prisma enums/models, and provider/prompt read
      views with execution state (`queued`, `running`, `completed`) independent of
      revision lifecycle, terminal outcomes (`passed`, `incompatible`,
      `configuration_error`, `inconclusive`), and bounded failure codes; reshape the
      init migration, seeds, repositories, and compatibility identity without
      persisting provider bodies, credentials, prompts, or unbounded errors.
- [x] 12.2 Replace synchronous provider-test and prompt-evaluate tRPC execution with
      idempotent durable job acceptance: conditionally create or reuse a queued
      execution, enqueue exactly one job per immutable compatibility identity,
      return immediately, and make workers re-read and persist the exact current
      identity.
- [x] 12.3 Apply one evaluator-versioned sampling policy that omits sampling
      overrides, including `temperature`, from provider tests, prompt tests, and runtime;
      execute provider-calling generation checks with maximum concurrency one while
      keeping local checks free of unnecessary queueing.
- [x] 12.4 Classify authentication/authorization, protocol/shape/behavior, throttling,
      timeout, transport, and provider/server outcomes without swallowing causes:
      store transient provider conditions as `inconclusive`, proven contract failures
      as `incompatible`, and never switch reasoning, answer protocol, model, or route
      to manufacture a pass.
- [x] 12.5 Update AI → Provider and AI → Features to poll durable evaluation status,
      resume after reload, prevent duplicate starts, stop at terminal state, display
      bounded per-check outcomes and explicit retry for inconclusive runs, and
      normalize non-JSON upstream/proxy responses without exposing native parser or
      DOM exception text.
- [x] 12.6 Add regression coverage for immediate mutation acceptance, jobs outliving
      the original HTTP request, duplicate-start idempotency, worker retry/restart,
      serial provider-call concurrency, deterministic request controls, transient
      versus incompatible classification, page reload/poll completion, safe non-JSON
      errors, and repeated identical evaluations; update operational and provider
      integration documentation before rerunning all final gates.

## Verification record (2026-08-12)

- Focused shared Vitest: `pnpm --filter @customreport/shared exec vitest run
src/schemas/ai-provider-configuration.test.ts src/schemas/ai-prompt-management.test.ts
src/schemas/report-assistant.test.ts src/schemas/report-assistant-search-plan.test.ts
src/schemas/telemetry.test.ts` — 5 files, 46 tests passed.
- Focused API Vitest: `pnpm --filter @customreport/api exec vitest run` over the
  provider, prompt, runtime, adapter, telemetry, and admin-router suites — 23 files,
  121 tests passed. Focused web Vitest over the AI provider/settings and report
  assistant suites — 5 files, 68 tests passed.
- PostgreSQL: `DATABASE_URL=postgresql://customreport:localdev@localhost:5433/customreport_test
DIRECT_URL=postgresql://customreport:localdev@localhost:5433/customreport_test
NODE_ENV=test pnpm --filter @customreport/api test:integration` — 50 files passed,
  342 tests passed, 2 skipped; the provider/prompt control-plane cases passed 9/9.
- E2E: `AI_PROVIDER_ALLOWED_ORIGINS=https://api.mistral.ai,https://openrouter.ai,https://ai.example.com
pnpm test:e2e:integration` with the distinct `E2E_DATABASE_URL` — 52/52 passed
  across Chromium, iOS, and Android.
- Repository gates passed: `pnpm catalog:check`, `pnpm typecheck`, `pnpm build`,
  `pnpm lint:md`, `pnpm exec eslint .`, stylelint, dependency-cruiser, Knip,
  `pnpm lint:status-literal-unions`, and `pnpm lint:playwright-image`.
- The remaining unchecked 9.3 gate is blocked only by the unrelated baseline
  `pnpm lint` failure: `lint:prisma:typecheck` reports the existing Nest `@Cron`
  decorator errors in `apps/api/src/modules/reminders/reminders-reaper.scheduler.ts:32`
  and `apps/api/src/modules/reminders/reminders.scheduler.ts:54`. The full `pnpm test`
  suite passes outside the sandbox (shared 454 tests, API 1,974 tests across 207 files,
  web 2,065 tests across 221 files, and Prisma 16 tests); the restricted-sandbox
  attempt failed only because its throttler tests could not bind `0.0.0.0`.

## Final verification record (2026-08-13)

- `pnpm catalog:check` — passed: 22 code routes (2 excluded), 20 catalog
  routes, no drift.
- `pnpm typecheck`, `pnpm lint`, and `pnpm lint:md` — passed. The Prisma
  checker now enables `experimentalDecorators`, matching the API compiler
  configuration required by imported Nest scheduler types.
- `pnpm test` — passed with host access for local HTTP fixtures: shared 454,
  API 1,976, web 2,066, and Prisma 16 tests. The logger async-drain test and
  AppModule loader timeout were stabilized without weakening their contracts.
- `pnpm build` — passed for all five Turbo tasks.
