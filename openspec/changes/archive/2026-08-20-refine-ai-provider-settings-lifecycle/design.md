## Context

The partially implemented change already adds a compact `AiProviderCard` and
safe discard for `draft`/`failed` provider attempts. That work remains valid,
but its original placement under Settings → Integrations no longer fits the
near-term product: two more AI features are planned after the Lead report
assistant. Provider configuration is global, while prompts and behavior belong
to individual AI features.

Today the report assistant imports four system-prompt constants directly from
`report-assistant.prompt-text.ts`. `AiRuntimeResolver` resolves one immutable
provider revision per request, but prompt identity is absent from the runtime
snapshot. The prompt contract requires evaluation when either prompts or models
change, yet there is no durable prompt revision or evaluated provider/prompt
pair.

### Current flow

```text
Settings → Integrations → AiProviderCard
                         |
AiProviderControl -------+----> AiRuntimeResolver(provider revision)
                                      |
hard-coded prompt constants ----------+----> planner / answer adapters
```

### Target flow

```text
Settings → AI
  ├── Overview
  ├── Provider ---------> AiProviderControl
  └── Features
       └── Report Assistant
            └── prompt draft → synthetic evaluation → active bundle pointer
                                                       |
AiRuntimeConfigurationRepository ----------------------+-- one request snapshot
                                                       |
                           provider revision + feature prompt bundle
                                                       |
                                      planner / repair / answer / repair
```

## Goals / Non-Goals

**Goals:**

- Establish one scalable AI administration area before additional AI features
  arrive.
- Preserve the global provider lifecycle and the partially implemented compact
  disclosure/discard workflow.
- Give each registered AI feature an independent, atomically activated prompt
  bundle with immutable history and exact restore targets.
- Let administrators version and replace the complete text of each registered
  prompt while keeping slots, tools, schemas, and runtime controls code-owned.
- Let administrators keep provider-default reasoning, disable it, or enter one
  provider-specific reasoning value for the global provider without exposing
  provider-routing or raw request-JSON controls.
- Prove a prompt/provider pair with synthetic data before activation and use one
  immutable pair throughout every request.
- Make the database the sole runtime source after an explicit bootstrap and keep
  prompt bodies out of logs, metrics, traces, and audit payloads.

**Non-Goals:**

- Implement the next two AI features or let administrators invent feature keys.
- Per-user/per-role prompt selection, experiments, traffic splitting, or
  automatic provider failover.
- Simultaneously activate an unproven provider and prompt candidate; each
  candidate must be compatible with the currently active counterpart.
- Let administrators edit tool schemas, response schemas, ACL, retrieval limits,
  slot identity, or other code-owned runtime controls.
- Expose provider-routing controls or allow arbitrary reasoning/request JSON.
- Add automatic retention, bulk deletion, or deletion of superseded provider or
  prompt revisions.

## Decisions

### 1. Promote AI to a dedicated Settings workspace

Add an **AI** Settings sub-tab with local **Overview**, **Provider**, and
**Features** navigation. Move the existing provider control into Provider;
Integrations returns to external integrations such as Element. Overview shows
global provider availability and registered feature readiness. Features lists
only code-registered features and initially exposes Report Assistant.

The provider disclosure remains compact when stable and expands for intent or
attention exactly as the original change specifies. Provider-attempt discard
also remains unchanged.

Alternative considered: keep prompts beside the provider in Integrations.
Rejected because three product AI features would turn one external-integration
card into the product's AI control plane and obscure feature ownership.

### 2. Register feature prompt contracts in code

Introduce an `AiFeaturePromptCatalog`. Each entry owns a stable feature key,
display metadata, required prompt slots, the current locked-core snapshot,
editable-instruction schema, deterministic composer, and synthetic evaluator.
Administrators cannot add feature keys or slots through the API.

The first entry is `lead-report-assistant` with four atomic slots: planner,
planner repair, grounded answer, and citation repair. Future AI features add
catalog entries and evaluators without changing prompt persistence or admin
navigation.

Alternative considered: store arbitrary prompt names and templates. Rejected
because it would let UI data define executable product capabilities and would
remove compile-time ownership of protocol boundaries.

### 3. Persist feature-scoped immutable prompt bundles

Add:

- `AiPromptBundleRevision`: feature key, monotonic feature-local revision,
  base revision, core-contract version, locked-core snapshot, editable
  instructions, effective-content hash, lifecycle, actor-safe timestamps, and
  activation/supersession metadata.
- `AiFeaturePromptControl`: one row per registered feature with a nullable active
  bundle pointer.
- `AiPromptEvaluation`: immutable result keyed by bundle revision, provider
  revision, content hash, and evaluator version.

Prompt content is immutable after save. Editing creates a new draft from a
selected base. Lifecycle states mirror the useful provider vocabulary:
`draft`, `validated`, `active`, `failed`, and `superseded`. Only `draft` and
`failed` prompt attempts may be discarded; active, validated, and superseded
rows remain exact activation or restore evidence.

The server snapshots locked core text into every revision so history and preview
remain reproducible. Admin writes accept only editable instruction fields; they
never accept locked text, slot names, feature keys outside the catalog, version
numbers, hashes, or lifecycle state.

Alternative considered: add four prompt columns to
`AiProviderConfiguration`. Rejected because prompt-only changes would duplicate
credentials, couple feature behavior to embedding preparation, and fail to scale
to additional features.

### 4. Version complete prompt text, with code-owned structural controls

For each catalog-owned slot, the administrator edits the complete system-prompt
text. Saving always creates a new immutable draft, while the active version keeps
serving until the candidate passes synthetic evaluation and is activated. The UI
starts with a compact list of prompt names; opening one item reveals its editor so
four long prompt bodies never dominate the page.

Tool choice, parallel-call settings, generated JSON schemas, message/data
separation, ACL, citation validation, and runtime limits remain code-owned
regardless of prompt text. Validation rejects empty required slots, control
characters, oversized content, unknown fields, and content whose deterministic
hash does not match the evaluated revision.

Alternative considered: preserve a locked core. Rejected because this workspace is
admin-only and immutable history plus evaluation provide a clearer recovery path
without hiding critical prompt text behind an uneditable layer.

### 5. Evaluate the exact provider/prompt pair before activation

Prompt evaluation runs against the active immutable provider revision and sends
only synthetic questions, catalogs, grounding, and citations. The report
assistant evaluator covers the documented Russian/English planning, exact versus
semantic retrieval, aggregate, insufficient-evidence, citation, injection, and
context-budget cases. Results contain safe check codes and counts, never provider
bodies or prompt text.

Prompt activation transactionally rechecks that:

- the bundle content hash and evaluator version match the passed evaluation;
- the evaluated provider revision is still globally active and enabled;
- the bundle lifecycle is `validated` or a retained restorable lifecycle; and
- the feature key and required slots still match the code catalog.

It then swaps only that feature's active prompt pointer and supersedes the prior
bundle. Prompt-only activation never rebuilds embeddings.

Provider capability testing continues its generic tool/schema/embedding probes
and additionally evaluates every active feature prompt bundle against the
candidate provider revision. Provider activation fails closed if any registered
active feature is incompatible. A pointer change after testing invalidates the
stale compatibility result.

Provider testing and prompt evaluation are durable asynchronous workflows, not
long-running tRPC responses. The initiating mutation conditionally creates or
reuses an execution with state `queued`, enqueues exactly one job for the immutable
compatibility identity, and returns after durable acceptance. A worker moves it to
`running`, re-reads the exact provider/prompt identities, executes the suite, and
persists state `completed` with outcome `passed`, `incompatible`,
`configuration_error`, or `inconclusive`. Execution state is independent of the
provider or prompt revision lifecycle: a pass may advance the candidate to
`validated`, a proven incompatibility or configuration error may move it to
`failed`, and an inconclusive run leaves the pre-test lifecycle unchanged. Settings
reads expose that execution, and the UI polls until `completed`. Reloading resumes
observation of the same job. A concurrent start for the same identity reuses the
in-flight execution instead of duplicating provider traffic.

Generation probes use the same request controls as runtime and omit sampling
overrides such as `temperature`, leaving supported sampling behavior to the selected
provider/model. The request policy is included in the evaluator version. Provider
generation calls run with a fixed maximum concurrency of one; local checks that do
not call the provider may still run immediately. This avoids burst-throttling without
adding a routing or performance control to the universal form.

Every check records one bounded outcome: `passed`, `incompatible`, or
`inconclusive`. Schema/protocol/behavior assertion failures are incompatibilities.
Authentication and authorization failures are terminal configuration failures.
Throttling, timeout, transport, and provider/server failures are inconclusive and
MUST NOT be represented as model or prompt incompatibility. The worker does not
switch reasoning values, answer protocols, models, or routes to obtain a pass; an
administrator may explicitly retry an inconclusive execution.

Each provider revision stores one generation reasoning configuration:
`provider_default`, `off`, or `custom`. A `custom` configuration additionally stores
one trimmed, non-empty provider-specific text value of at most 64 characters; the
other configurations store no custom value. The text is an opaque reasoning-effort
value, not raw JSON or a general request-parameter escape hatch.

The profile adapter owns the wire shape:

| Profile                    | `provider_default` | `off`                           | `custom` value `V`         |
| -------------------------- | ------------------ | ------------------------------- | -------------------------- |
| `openrouter`               | omit reasoning     | `reasoning: { effort: "none" }` | `reasoning: { effort: V }` |
| `mistral`                  | omit reasoning     | `reasoning_effort: "none"`      | `reasoning_effort: V`      |
| `custom-openai-compatible` | omit reasoning     | `reasoning_effort: "none"`      | `reasoning_effort: V`      |

This mapping belongs in profile-specific configuration or adapters before the
generic transport boundary; the shared transport does not infer a profile or
reinterpret the custom value. The exact configuration is applied to planner,
planner-repair, answer, and citation-repair calls. Capability testing exercises it
independently through planner and answer probes. A provider rejecting the field or
value, or failing either contract, cannot be validated and returns a bounded safe
failure. The UI does not expose raw JSON or routing modes such as Nitro or Exacto.

Answer structure remains code-owned, but its transport has two supported protocols:
strict `json_schema` response format and one forced, side-effect-free
`submit_grounded_report_answer` tool whose arguments use the same generated answer
schema. Capability testing tries `json_schema` first. Only a bounded protocol-shape
incompatibility permits the forced-tool probe; authentication failures, timeouts,
rate limits, and provider/server failures stop the test instead of masquerading as
protocol negotiation. The successful protocol is persisted on the provider
revision and used by the exact feature-prompt evaluation. Neither protocol may
activate unless the parsed payload passes the same server-owned Zod schema and
feature checks.

Runtime uses only the persisted tested answer protocol. It never retries a user
request through the other protocol. Restore and activation recheck that the stored
reasoning configuration, including the exact custom value when present, and answer
protocol are covered by current generic and feature evaluation versions.

Alternative considered: treat provider and prompt validation independently.
Rejected because a prompt can pass on one model and fail validly structured
behavior on another.

Alternative considered: increase output token limits until reasoning models reach
their forced tool call. Rejected as the compatibility mechanism because latency and
completion remain input-dependent and a larger budget does not add missing strict
output support; operators may still tune the existing code-owned output limits.

Alternative considered: replace JSON Schema output globally with a forced answer
tool. Rejected because some providers support strict structured output but not
reliable tools; validation-time protocol selection preserves the broader compatible
set without introducing runtime fallback.

### 6. Resolve one feature runtime snapshot per operation

Add a deep runtime-configuration repository that reads the enabled active provider
and the requested feature's active prompt bundle under one repeatable database
snapshot. `AiRuntimeSnapshot` gains feature key, prompt revision ID, contract
version, the composed prompt set, and the provider revision's tested reasoning
configuration and answer protocol. Planner and answer adapters receive that set
instead of importing constants, so planner repair and citation repair cannot cross an
activation boundary inside one request.

Cache generation clients by provider revision and prompt-aware adapters/factories
by provider-plus-prompt identity. Exact-revision embedding workers continue to
resolve only the provider revision and semantic scope; they do not depend on a
feature prompt pointer.

Lead Chat availability becomes the conjunction of an enabled active provider and
an active compatible `lead-report-assistant` prompt bundle. Missing or corrupt
prompt state returns the existing `ai_not_configured` behavior before retrieval;
there is no fallback to compiled prompt text.

Alternative considered: independently query provider and prompt controls under
ordinary read-committed statements. Rejected because an activation between those
reads could create a pair that was never evaluated.

### 7. Bootstrap current v1 behavior explicitly

An idempotent bootstrap creates the report-assistant feature control and the first
active bundle from the current four v1 prompts only when no prompt-control data
exists. Existing provider bootstrap and prompt bootstrap remain explicit rollout
operations; neither becomes a runtime fallback. Fresh installations receive the
same baseline through seed/bootstrap orchestration.

Because the project has no production point, Prisma schema and the single init
migration may be reshaped and disposable dev/test/UAT databases reset. The
destructive guard remains authoritative; any non-disposable database requires a
reviewed additive migration and backfill instead of reset.

### 8. Audit transitions without copying prompt content

Draft creation, evaluation, activation, restore, discard, and bootstrap emit safe
audit events containing actor, feature key, revision IDs, content hash, contract
and evaluator versions, provider revision ID, transition, and timestamps. Prompt
bodies, questions, evidence, generated output, credentials, and provider response
bodies remain absent from audit, logs, traces, errors, jobs, and metric labels.

Metrics use bounded feature/check/outcome labels only; revision IDs and hashes are
not metric labels. Runtime debugging correlates retained versions with activation
audit history rather than logging prompts.

### 9. Treat documentation and evaluation fixtures as release artifacts

Update `docs/llm-report/lead-report-assistant-prompt-contract.md` from
code-owned full text to locked-core plus admin-instruction composition. Update the
LLM README, decision summary, architecture and logical-flow diagrams, rollout and
provider-integration guidance, and relevant docs indexes. The docs must identify
the database/runtime source of truth, bootstrap order, evaluation gate, restore
procedure, and no-fallback behavior.

The deterministic evaluation fixtures are versioned product assets and covered by
tests. Changes to locked core, composer version, evaluator version, model IDs, or
context limits require a new evaluation record before activation.

## Risks / Trade-offs

- **[The widened change overlaps seven already completed tasks]** → Preserve their
  checkmarks and implementation; relocate the provider UI without undoing its
  disclosure/discard behavior.
- **[A prompt passes schema checks but changes intent]** → Gate activation on the
  feature-specific synthetic suite and show the active-versus-candidate diff.
- **[Provider or prompt changes during evaluation]** → Key results to immutable
  revision IDs, content hash, and evaluator version; recheck all at activation.
- **[Compatibility evaluation exceeds an HTTP proxy timeout]** → Persist and run it
  as a background job; return acceptance immediately and poll durable status.
- **[Concurrent synthetic probes trigger provider throttling or inconsistent
  routing]** → Run provider generation probes at concurrency one, use the same
  sampling policy as runtime, and classify transient failures as inconclusive.
- **[A non-JSON proxy failure reaches the browser]** → Normalize transport failure
  to a bounded actionable UI message and never display a native parser/DOM error.
- **[A reasoning field or custom value is unsupported by one selected model]** →
  Probe both planner and answer contracts and fail validation with a bounded safe
  code while retaining the attempted value for correction.
- **[Protocol negotiation hides a transient outage]** → Fall through from JSON
  Schema to forced tool only for classified protocol incompatibility, never for
  transport, authentication, throttling, timeout, or server failures.
- **[Forced answer tool arguments violate the answer schema]** → Parse the single
  named call and validate its arguments through the same strict server schema used
  for JSON Schema responses.
- **[Editable instructions conflict with locked core]** → Keep structural controls
  in code, delimit the editable layer, exercise injection cases, and reject rather
  than auto-rewrite a failing candidate.
- **[Prompt text consumes model context]** → Enforce per-slot/composed limits and
  evaluate representative maximum grounding before activation.
- **[New AI features tempt generic untyped JSON]** → Require a code catalog entry
  and feature-specific shared schema before storage or UI exposure.
- **[Nested settings navigation becomes dense]** → Keep one top-level AI sub-tab
  and local Overview/Provider/Features navigation with responsive behavior.
- **[Old core snapshots drift from a future runtime protocol]** → Require current
  evaluator compatibility before restore and retain explicit contract versions.

## Migration Plan

1. Finish and verify the already implemented provider disclosure/discard slice so
   its behavior is a stable baseline.
2. Add prompt schemas, feature catalog, Prisma models, init migration, repositories,
   and bootstrap fixtures; reset only disposable databases.
3. Add prompt services, synthetic evaluators, admin procedures, audit events, and
   provider-compatibility integration while runtime still uses code prompts.
4. Extend provider revisions and the Provider form with default/off/custom reasoning;
   negotiate and persist the answer protocol during capability testing before any
   revision can validate.
5. Add the AI Settings workspace, move the provider card, and deliver prompt draft,
   diff, evaluation, activation, history, restore, and discard UI.
6. Run the prompt bootstrap in every environment and verify the active baseline
   bundle reproduces the current v1 contract.
7. Switch the report-assistant runtime and availability read to the durable prompt
   snapshot, then remove static prompt constants from runtime use.
8. Update and verify all durable documentation, diagrams, runbooks, E2E catalog
   coverage, focused tests, and full quality gates before rollout.
9. Roll back application code only while retaining prompt rows. If runtime rollback
   requires code-owned prompts, restore the previous compatible deployment; never
   introduce a silent dual source of truth.

The role-coverage gate remains enforced through canonical admin and Lead procedure
builders. The period dual-state invariant and report writes are untouched. The
destructive guard governs resets, and no live AI surface receives a Coming Soon
affordance.

## Open Questions

None. Simultaneous provider-plus-prompt candidate activation, experiments,
retention policy, and the two future AI features are explicitly deferred.
