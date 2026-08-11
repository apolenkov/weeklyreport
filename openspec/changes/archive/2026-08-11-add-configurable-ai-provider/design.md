## Context

The report assistant currently constructs Mistral planner, answer, and embedding adapters as Nest singletons from required environment values during API boot. The semantic queue also holds one boot-time embedding scope, while its jobs carry only a source locator and content hash. The admin Integrations surface shows a non-functional AI card.

The change crosses shared contracts, Prisma, admin tRPC, the web settings surface, the synchronous assistant path, BullMQ workers, environment validation, secret handling, and three durable assistant specifications. Configuration is organization-wide: only `admin` can manage it, while existing feature authorization remains unchanged (the Lead assistant does not become available to other roles).

### Current data flow

```text
MISTRAL_* env
      |
      v
Nest boot-time singletons --------------------+
      |                                       |
      +--> planner --> retrieval --> answer   +--> embedding worker
```

### Target data flow

```text
Admin Integrations UI
      |
      v
draft revision --> synthetic capability test --> prepare embedding scope
                                                     |
                                        old active remains in service
                                                     |
                                                     v
                                      atomic active-pointer swap
                                                     |
                  +----------------------------------+------------------+
                  v                                  v                  v
          request runtime snapshot             read-through       BullMQ jobs
          (planner + answer + scope)            embeddings         (revision ID)
```

Typical capability testing is expected to take about 10–60 seconds. Reindexing has no product SLA because provider rate limits and corpus size dominate; the UI reports exact completed, total, and failed counts instead of inventing an ETA. A small departmental corpus will commonly finish in minutes, while a large history can take tens of minutes.

## Goals / Non-Goals

**Goals:**

- Let only `admin` manage one configuration used globally by all authorized users and workers.
- Support Mistral, OpenRouter, and an allowlisted custom OpenAI-compatible endpoint through one capability-oriented runtime.
- Encrypt provider credentials and keep plaintext out of reads, logs, jobs, metrics, and audit records.
- Validate forced tool calling, structured answers, and embeddings before a revision can affect users.
- Keep the old runtime active while a changed embedding scope is populated, then switch atomically.
- Preserve report-write independence, explicit provider failures, and manual—not automatic—provider switching.

**Non-Goals:**

- Per-user/provider selection or granting new roles access to the Lead assistant.
- Automatic failover, provider routing, price optimization, or model recommendations.
- Non-OpenAI-compatible custom protocols, arbitrary authentication schemes, or mTLS management in v1.
- A guaranteed reindex duration or reuse of vectors across scopes that are not proven identical.

## Decisions

### 1. Store immutable configuration revisions behind one global control row

Add `AiProviderConfiguration` revisions and an `AiProviderControl` singleton. A revision contains the profile, normalized base URL, model identifiers, embedding dimensions measured from the provider response, encrypted Bearer credential metadata, embedding identity, lifecycle state, validation result, and timestamps. A new draft has no measured dimensions and cannot be activated. The control row owns the nullable active revision pointer and enabled state. A transaction changes that pointer, making the one-active-configuration invariant structural rather than a query convention.

Lifecycle states are `draft`, `validated`, `preparing`, `active`, `failed`, and `superseded`. Saving creates or replaces a draft; testing moves it to `validated`; activation either swaps immediately when its embedding scope matches the active scope or moves it to `preparing` and starts indexing. Successful preparation performs the pointer swap and supersedes the prior revision. Failure leaves the old pointer unchanged. Disabling clears availability without deleting the retained revision or credential.

Alternative considered: add provider fields directly to `AppSettings`. Rejected because secrets, lifecycle, progress, revision identity, and atomic rollback do not belong in the broad settings PATCH contract.

### 2. Acquire one immutable runtime snapshot per operation

Replace boot-time Mistral adapter injection with an `AiRuntimeResolver`. `ReportAssistantService` acquires the active revision once at the beginning of a request and uses the resulting planner, answerer, embeddings adapter, model telemetry identity, and semantic scope throughout that operation. The resolver may cache constructed clients by immutable revision ID, but it resolves the active pointer from durable state so multiple API instances observe activation without restart.

Workers never ask for “whatever is active.” Each semantic job carries its configuration revision ID and complete non-secret embedding scope; the worker resolves that exact revision and rejects a scope mismatch. This prevents an activation in the middle of a request or queue backlog from combining one model's query vector with another model's document vectors.

Alternative considered: dynamic proxy adapters that resolve independently on every planner/answer call. Rejected because one assistant request could straddle an activation.

### 3. Use one OpenAI-compatible transport with explicit provider profiles

The transport implements the existing application ports and normalizes chat completions, forced function calls, JSON-schema responses, token usage, embeddings, timeouts, and errors. Profiles provide fixed behavior for `mistral` and `openrouter`; `custom-openai-compatible` accepts an administrator-supplied base URL and free-form model identifiers. All three use one Bearer credential in v1.

Compatibility is proven by the synthetic test, not assumed from the profile name or `/models` metadata. The planner test forces exactly one harmless synthetic tool call, the answer test validates a strict synthetic JSON schema, and the embedding test validates batching, finite numbers, ordering, and one consistent positive vector length. The measured length is persisted only after the test passes; no embedding dimensions option is sent to the provider. No report content is sent during testing.

Alternative considered: retain one SDK-specific adapter per vendor. Rejected for duplicated protocol logic, but profile hooks remain available for real dialect differences. A future non-compatible corporate API can implement the existing application ports without changing this contract.

### 4. Gate custom endpoints by deployment policy

`AI_PROVIDER_ALLOWED_ORIGINS` is a required, explicit deployment list. Every built-in or custom normalized base URL must match an allowed origin. URLs with user info, fragments, or query strings are rejected; redirects are disabled rather than followed to a new origin. HTTP is accepted only when its exact origin is explicitly listed, allowing an intentional internal corporate gateway without silently weakening other environments.

This makes endpoint choice flexible inside the corporate network while preventing the admin form from becoming an unrestricted server-side request primitive.

### 5. Encrypt credentials with an environment-owned master key

Use authenticated encryption (AES-256-GCM) with a required `AI_PROVIDER_CONFIG_ENCRYPTION_KEY` and an explicit key version. Persist ciphertext, nonce, authentication tag, key version, and a short masked suffix only. The API accepts a replacement credential on write but never returns ciphertext or plaintext. Empty credential input means “retain the existing credential” only when editing a revision derived from the current draft; it is invalid for a new configuration.

The master key and allowed origins remain deployment configuration and have no defaults. Product-selected provider, endpoint, credential, and models live in the database. Operational budgets and limits remain explicit environment configuration.

Alternative considered: store the provider key directly in `AppSettings` or continue to require a provider key in env. The first is unsafe; the second cannot satisfy runtime admin configuration.

### 6. Give each embedding endpoint/model a stable coexistence-safe scope

Derive a non-secret provider identity from the profile plus a digest of the normalized base URL. The semantic scope remains provider identity, model, semantic-input version, and dimensions. Add dimensions to the `SemanticEmbedding` primary key so an old and staged vector of different dimensions can coexist. A credential rotation or planner/answer-only change preserves the scope and does not reindex; endpoint, embedding model, dimensions, or input-version changes create a new scope.

Activation preparation enumerates canonical semantic sources, queues locators and expected hashes for the draft revision, and exposes completed/total/failed progress. Before swapping the active pointer, the coordinator recomputes the current canonical hash set and requires zero missing or failed embeddings for the new scope. Concurrent report edits therefore cannot make a stale enumeration look complete.

Old cache rows remain available for rollback and are excluded by exact active-scope filtering. Cleanup is deliberately deferred.

### 7. Separate configuration visibility from feature authorization

The configuration tRPC procedures use the canonical `adminProcedure`; `head`, `lead`, `viewer`, and anonymous callers receive the normal audited denial. The admin read model exposes status, masked credential state, models, endpoint, test result, and indexing progress.

Authorized product surfaces receive only a minimal availability value (`available` or `not_configured`) and no provider, endpoint, model, or secret metadata. When unavailable, the Lead Chat control remains visible but disabled with English explanatory copy. Direct assistant calls return the explicit `ai_not_configured` outcome. Existing Lead-only middleware remains unchanged.

### 8. Audit control-plane changes without leaking secrets

Save, test, activation request, activation success/failure, disable, and bootstrap emit admin audit events containing actor, configuration/revision ID, profile, model identifiers, status transition, and safe failure classification. Events, logs, traces, metrics, BullMQ payloads, and tRPC errors exclude credentials and provider response bodies. There is no automatic fallback; transient runtime failures retain `provider_unavailable`.

### 9. Bootstrap the existing Mistral configuration explicitly once

Provide an idempotent rollout/bootstrap operation that, only when no control/configuration rows exist, reads the legacy validated Mistral environment values, encrypts the credential, creates a tested active revision, and records a bootstrap audit event. Fresh installations without an explicit bootstrap start with AI unconfigured. Runtime resolution never falls back to legacy env after database configuration exists.

After rollout verification, legacy `MISTRAL_*` requirements can be removed from normal boot configuration. This avoids both an outage and a permanent dual source of truth.

## Risks / Trade-offs

- **[A provider claims compatibility but violates a required feature]** → Exercise the exact forced-tool, strict-schema, usage, and embedding contracts before activation.
- **[A malicious or mistaken endpoint targets internal services]** → Require an exact deployment origin allowlist, normalize URLs, reject user info/query/fragment, and disable redirects.
- **[Credential disclosure through an ancillary path]** → Encrypt at rest and design masked DTOs, safe errors, audit events, job payloads, logs, traces, and tests as separate boundaries.
- **[Embedding preparation never converges during heavy editing]** → Reconcile current hashes before activation, retry bounded failures, expose failed counts, and leave the old configuration active.
- **[Large-corpus activation takes much longer than expected]** → Make it asynchronous, expose counts and elapsed time, avoid a promised ETA, and keep current service uninterrupted.
- **[Multiple API/worker instances observe different configuration]** → Use the durable active pointer and immutable revision IDs; cache clients only by revision, never the active choice itself.
- **[Cache storage grows with model switches]** → Preserve old scopes for safe rollback now and schedule retention/cleanup as a separate capability later.
- **[The generic transport hides provider-specific semantics]** → Keep explicit profiles and normalization hooks; reject rather than silently downgrade unsupported parameters.

## Migration Plan

1. Add the required encryption key and allowed-origin configuration to every environment and verify them before database work.
2. In the current pre-production MVP phase, reshape `prisma/schema.prisma` and the single init migration, then reset disposable `_dev`, `_test`, and `_uat` databases. Never reset a production database; if any non-disposable target has applied the init migration, create and review an additive migration instead.
3. Deploy storage, encryption, admin APIs, runtime resolver, transport profiles, scoped jobs, and UI while retaining the legacy Mistral bootstrap inputs.
4. Run the idempotent bootstrap, verify that the imported Mistral revision is active, and smoke-test the Lead assistant and background embeddings.
5. Remove the AI `ComingSoonBadge` only when the end-to-end admin workflow is live. Remove legacy Mistral env use after all environments have an active database revision or intentionally show the unconfigured state.
6. Roll back application code by restoring the previous compatible deployment while retaining configuration rows. A failed new activation never needs rollback because the old active pointer is unchanged; after activation, an admin can explicitly re-activate the retained prior tested revision without revealing its credential.

The period dual-state invariant is untouched: report writes remain independent of AI and never wait for provider or Redis work. The role-coverage gate is preserved through `adminProcedure` and the existing Lead procedure. The destructive guard remains authoritative for any non-disposable database. The deferred-feature rule is preserved by keeping the badge until the implementation is complete.

## Open Questions

No product decision blocks implementation. During implementation, verify the exact OpenAI-compatible request/response dialects of the pinned Mistral and OpenRouter client versions and measure representative indexing throughput to tune existing batch and concurrency limits; neither result changes the product contract.
