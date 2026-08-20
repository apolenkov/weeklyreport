## Context

`AiProviderConfiguration` is currently an immutable revision with one profile, base URL, endpoint identity, encrypted credential, planner model, answer model, and embedding model. `AiRuntimeResolver` resolves that revision into one transport used by generation and embedding calls. Provider testing, prompt compatibility, semantic scope, and the global active pointer therefore all use the provider revision as a single identity.

This design extends the revision and asynchronous evaluation lifecycle introduced by `refine-ai-provider-settings-lifecycle`; that change must land first. The project is pre-production, so the Prisma schema and single init migration may be reshaped and disposable databases reset. The solution must remain fail-closed, keep credentials server-side, avoid runtime fallback, and preserve the old active configuration while a new embedding scope is prepared.

### Before

```text
Settings form
  -> one profile / endpoint / credential
  -> AiProviderConfiguration
  -> one transport
       -> planner + answer
       -> embeddings
```

### After

```text
Settings form
  -> generation connection -----------------> generation transport
  |      profile / endpoint / credential          -> planner + answer
  |
  -> embedding mode
         |-- reuse generation --------------------> same connection, embedding model
         `-- separate connection ------------> embedding transport
                profile / endpoint / credential       -> embeddings

Both halves -> one immutable composite revision -> one tested active pointer
```

## Goals / Non-Goals

**Goals:**

- Configure generation and embeddings through independent provider connections and credentials.
- Support the intended generation/embedding combinations through one role-aware profile catalog.
- Test, store, activate, restore, audit, and resolve the two connections as one immutable composite revision.
- Reuse embeddings and prompt evaluations when the relevant connection identity is unchanged.
- Keep the existing active revision serving until the candidate embedding scope is complete.

**Non-Goals:**

- Separate providers for planner and answer.
- Provider routing controls, automatic failover, or load balancing.
- Silent fallback between the two connections.
- Arbitrary request JSON or provider-specific settings beyond the existing bounded controls.

## Decisions

### 1. One composite revision owns two connection roles

The shared draft contract becomes structurally nested:

```text
generation: {
  profile, baseUrl?, credential?, plannerModel, answerModel,
  reasoningMode, reasoningCustomValue?
}
embeddings:
  | { mode: "reuse_generation", model }
  | { mode: "separate", profile, baseUrl?, credential?, model }
```

`AiProviderConfiguration` remains the unit of lifecycle and activation. Its generation fields are required. Separate embedding connection fields are present only in `separate` mode; a database CHECK enforces the discriminated shape. The embedding model and measured dimensions remain revision data in both modes. In reuse mode the effective profile, endpoint, and credential are derived from generation and no second encrypted secret is stored.

This is preferred to separate generation and embedding revision tables with independent active pointers. Independent pointers could create a generation/embedding pair that was never tested or prepared together. A composite revision permits independent connections without weakening atomic activation.

### 2. Provider profiles are role-aware metadata, not separate UI implementations

One server-owned profile registry supplies fixed endpoint resolution, allowlist validation, request translation, and supported roles. The initial catalog is:

| Profile                    | Generation | Embeddings |
| -------------------------- | ---------- | ---------- |
| `mistral`                  | yes        | yes        |
| `openrouter`               | yes        | yes        |
| `openai`                   | yes        | yes        |
| `groq`                     | yes        | no         |
| `jina`                     | no         | yes        |
| `custom-openai-compatible` | yes        | yes        |

The shared read contract exposes safe profile capability metadata so the universal form can filter the same profile selector by connection role. Fixed endpoints remain code-owned and deployment-allowlisted. Custom endpoints retain normalization and SSRF protections. Adding a profile later changes registry metadata and adapters, not the form structure.

This is preferred to a free-form provider name or separate Jina/Groq screens, both of which would either defer incompatibility until provider calls or fragment the integration UI.

### 3. Credential retention is explicit and connection-scoped

Read models expose `hasCredential` and an optional masked suffix separately for generation and embeddings. A blank credential can inherit encrypted material from the base revision only when that connection's profile and normalized endpoint identity are unchanged. A new or changed connection requires a credential. Reuse mode accepts no embedding credential and always uses the generation credential.

Each separately stored credential uses the existing authenticated-encryption envelope with distinct additional authenticated data containing revision ID and connection role. Logs, jobs, errors, audits, and client contracts contain neither plaintext nor ciphertext.

This retains the safe edit experience without silently applying a credential to a different origin.

### 4. Capability testing has two ordered lanes and one terminal result

`admin.aiProvider.test` still durably accepts one asynchronous execution for an immutable composite identity. The worker records bounded sub-results under `generation` and `embeddings`:

- Generation: authentication, planner forced-tool behavior, token usage, reasoning translation, answer-protocol negotiation, and active feature prompt checks.
- Embeddings: authentication, batch input, finite ordered vectors, consistent dimensions, and token usage when supplied.

Requests are sequential within each lane. Authentication/configuration failure, throttling, timeout, transport failure, or provider/server failure stops subsequent requests on the affected connection. If both roles reuse one connection, such a terminal connection failure stops both lanes. A failure on a separate connection does not fabricate a result for the other connection. The composite passes only when both lanes have current passing evidence; transient failures remain `inconclusive`.

This is preferred to a single opaque capability list because it gives actionable diagnostics without launching cascades of doomed requests.

### 5. Compatibility uses scoped identities

The system derives three non-secret, versioned fingerprints:

- `generationCompatibilityIdentity`: generation profile and endpoint identity, credential version fingerprint, planner/answer models, reasoning configuration, tested answer protocol, sampling policy, contract version, and evaluator version.
- `embeddingScopeIdentity`: effective embedding endpoint identity, embedding model, semantic-input version, and measured dimensions. Credential rotation is intentionally excluded.
- `compositeTestIdentity`: both connection inputs plus profile-registry and capability-suite versions.

Prompt evaluations bind to `generationCompatibilityIdentity`, not the composite revision ID. Therefore changing only embeddings does not invalidate a valid prompt evaluation. Changing generation credentials or behavior does. Semantic cache keys and preparation depend only on `embeddingScopeIdentity`; generation changes and embedding credential rotation do not rebuild vectors. Activation transactionally verifies evidence for both identities and the exact candidate revision.

This is preferred to retaining revision ID as every compatibility key, which would force unrelated prompt re-evaluation and re-embedding.

### 6. Runtime resolves two transports from one snapshot

`AiRuntimeResolver` reads the active composite revision and compatible prompt bundle under the existing repeatable-read snapshot. It builds a generation transport for planner, repair, answer, and citation repair. It builds or aliases an embedding transport for query and corpus embeddings. Exact-revision workers resolve only the effective embedding connection and do not depend on prompt state.

No call may substitute the other transport after an error. Failure maps to the existing bounded assistant/indexing outcomes.

### 7. The universal form uses progressive disclosure

Settings → AI → Provider remains one form and one lifecycle card. It contains a required **Generation** section and an **Embeddings** section with `Same connection as generation` (default) or `Separate connection`. Separate mode reveals the existing provider, endpoint, credential, and model field pattern. Reasoning and detected answer protocol stay in Generation; measured dimensions stay in Embeddings. Test progress and failures are grouped by role.

This is preferred to two independent provider cards or activation buttons because administrators are configuring one serving revision, not two independently deployable integrations.

### 8. Activation prepares only changed embedding scope

Generation-only changes and embedding credential rotation activate without corpus preparation after all compatibility evidence passes. When `embeddingScopeIdentity` changes, the candidate enters preparation, its effective embedding transport populates the staged scope, and the previous composite remains active. Final reconciliation and one pointer swap activate the complete candidate. There is no mixed interval where generation uses the candidate while retrieval uses the previous embedding scope.

### 9. Load-bearing invariants remain unchanged

- **Period dual-state:** untouched; no report write path changes.
- **Role-coverage gate:** preserved; all `admin.aiProvider` procedures continue using canonical administrator middleware and assistant procedures retain their existing role/data gates.
- **Destructive-db guard:** preserved; schema resets are limited to disposable MVP databases and production destructive protection remains intact.
- **Deferred-feature pattern:** unchanged; this change delivers the two-connection behavior rather than hiding it behind a deferred control.

## Risks / Trade-offs

- **More configuration states can create invalid combinations** → discriminated shared schemas, role-filtered profiles, database checks, and composite capability testing reject them before activation.
- **Two credentials increase secret-handling surface** → connection-scoped encryption AAD, masked-only reads, and reuse mode without duplicated ciphertext.
- **Scoped evidence reuse could become stale after evaluator changes** → include registry, contract, sampling, and evaluator versions in fingerprints and recheck them transactionally.
- **Providers advertised as OpenAI-compatible can still differ** → every exact model/configuration pair must pass capability testing; profile metadata is not treated as proof.
- **A separate embedding provider adds another availability dependency** → preserve explicit failure and indexing-pending outcomes; do not mask it with fallback.
- **Existing lifecycle code may assume one endpoint identity** → introduce explicit `generation` and `embedding` value objects at the shared/domain boundary before changing repositories or adapters.

## Migration Plan

1. Land and verify `refine-ai-provider-settings-lifecycle`.
2. Update shared schemas and profile registry, then reshape `AiProviderConfiguration`, compatibility evidence, and the single init migration. Add database checks for embedding mode and credential shape.
3. Reset disposable dev/test/UAT databases under the destructive guard and regenerate Prisma.
4. Update bootstrap/seeds so every legacy single-provider revision becomes `reuse_generation`; no runtime compatibility fallback remains.
5. Update repositories, identity builders, tester lanes, runtime resolver, embedding workers, activation, and prompt evaluation.
6. Update the universal Settings form and revision/test summaries.
7. Run focused unit/integration/E2E coverage, then `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` before push.

Rollback before the first production point is code rollback plus a guarded reset of disposable databases. No production database reset is authorized.

## Open Questions

None. New provider profiles still require their fixed endpoints and request translations to be verified against official provider documentation during implementation.
