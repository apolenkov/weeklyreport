# Native Lead report assistant production runbook

This runbook covers the first production rollout of the Lead-only report
assistant. It assumes the application configuration is complete, the
PostgreSQL image is the pinned PostgreSQL 15 + pgvector image documented in
[`postgres-pgvector-rollout.md`](./postgres-pgvector-rollout.md), and the
operator has a restorable backup for every non-disposable database.

The assistant is stateless at the application layer. Questions, prompts,
evidence, answers, embeddings, report IDs, and names must not be written to
logs, traces, metrics labels, deployment output, or screenshots.

## 0. Release approvals and immutable configuration

Complete these approvals before placing report traffic in the production
workspace:

- Record the selected provider profile, endpoint destination, data region, and
  approved retention/ZDR posture before report traffic is enabled.
- Record model availability, spending limits, rate limits, and an owner for
  usage review for every selected provider.
- Keep the deployment origin allowlist exact. It must contain only approved
  HTTPS origins; it is not a general outbound proxy policy.
- Use pinned model IDs where the provider supports them. Planner, answer, and
  embedding models are provider configuration, not application constants.

The following values are required by `envSchema` and must be supplied by the
deployment secret/configuration system. Never commit a real key or put one in
an OpenSpec artifact:

```text
AI_PROVIDER_CONFIG_ENCRYPTION_KEY
AI_PROVIDER_CONFIG_KEY_VERSION
AI_PROVIDER_ALLOWED_ORIGINS
REPORT_ASSISTANT_INPUT_VERSION
REPORT_ASSISTANT_SIMILARITY_THRESHOLD
REPORT_ASSISTANT_CANDIDATE_LIMIT
REPORT_ASSISTANT_READ_THROUGH_LIMIT
REPORT_ASSISTANT_EXHAUSTIVE_LIMIT
REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET
REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS
REPORT_ASSISTANT_PLANNER_MAX_TOKENS
REPORT_ASSISTANT_ANSWER_MAX_TOKENS
REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE
REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET
```

The legacy `MISTRAL_*` values are optional one-shot bootstrap inputs only. For an
existing deployment, supply the complete set temporarily and run:

```bash
pnpm db:bootstrap-ai-provider
```

The operation encrypts the credential, creates a tested active revision, and
prints only safe state. It is a no-op when any AI control or configuration row
already exists. Remove the legacy values after verifying the imported revision;
normal runtime resolution never reads them.

The reviewed development values are in `.env.example`; test values use a
placeholder key and deterministic fakes and never contact Mistral. For the
provider facts and links to the primary sources, see
[`mistral-report-assistant-integration-2026-08-04.md`](./mistral-report-assistant-integration-2026-08-04.md).

## 1. Config before code

Load the production secret/configuration values first, then validate the
rendered Compose configuration without printing its contents:

```bash
docker compose -f docker-compose.prod.yml config --quiet
```

Confirm that the production deployment contains the required API, database,
Redis, SAML, PDF, SMTP, URL, and health-threshold values. A missing required
value must stop the deployment; do not add a fallback or temporarily reuse a
development secret.

Before starting a production-like database, detect whether the edited init
migration is already recorded:

```bash
MIGRATION_TARGET_ENV=production \
DATABASE_URL="$PRODUCTION_DIRECT_DATABASE_URL" \
pnpm db:check-init-target
```

If the command reports `stop_for_additive_migration`, stop. Create and review
an additive forward migration containing the pgvector extension, embedding
table, unique key, and vector-dimension check before deploying application
code. Never mark the edited init migration as newly applied and never reset a
production database. Disposable `_dev`, `_test`, and `_uat` targets may follow
the reset workflow described in the pgvector rollout inventory.

## 2. Network and provider preflight

Verify TLS/443 reachability for the selected allowlisted origin. After the API
is running, an administrator opens **Settings → AI → Provider**, configures the
provider credential and three model roles, then runs the provider capability
test. The test uses only synthetic non-report data and verifies authentication,
forced planner tool calling, fixed JSON Object Mode answer handling, usage, and
ordered finite embeddings. Authentication, rate limit, timeout, transport, and
provider failures are classified without trying another answer protocol. The
tested revision stores only the bounded provider capability result and exact
provider reasoning configuration (Provider default, Off, or a bounded Custom
value); runtime applies the fixed code-owned answer contract. Do not put the
credential, model IDs, or dimensions into deployment environment files. A
failed test, missing model, unexpected region, or blocked egress is a preflight
failure; do not test by sending report text.
Do not put the credential, model IDs, or dimensions into deployment environment
files. A failed test, missing model, unexpected region, or blocked egress is a
preflight failure; do not test by sending report text.

## 3. Database and service order

For a non-disposable target, record the current image digest, PostgreSQL
version, `vector` extension version, volume, backup/PITR point, and rollback
image. Validate a clone before touching the production volume. Run DDL through
the direct PostgreSQL connection, not PgBouncer:

```bash
docker compose -f docker-compose.prod.yml up -d postgres redis pgbouncer
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d api web
```

The migration container uses `DIRECT_URL` and must complete before the API is
healthy. API startup and all seed paths then run the idempotent Report Assistant
prompt bootstrap. Verify the database directly:

```sql
SELECT current_setting('server_version_num');
SELECT extversion FROM pg_extension WHERE extname = 'vector';
SELECT vector_dims(('[' || repeat('0,', 1023) || '0]')::vector);
```

The final query is a dimension smoke check only; the application migration
also enforces the configured dimension with a database constraint. Do not run
`prisma migrate reset`, `db:reset:hard`, or an equivalent destructive command
against production.

Verify that `AiFeaturePromptControl` has one active Report Assistant baseline
and that no prompt body, credential, report data, or provider response was
printed by migration or bootstrap logs. A newly bootstrapped active bundle is
usable only when its serving contract and active provider are structurally valid;
otherwise the runtime remains unavailable by design.

## 4. Smoke checks after deployment

Run the existing readiness checks first, then the application smoke checks:

```bash
curl --fail --silent --show-error "$API_HEALTH_URL/health/ready" > /dev/null
curl --fail --silent --show-error "$WEB_URL/" > /dev/null
```

In a disposable or approved staging session, verify the existing critical
paths before Chat: Lead draft save, Lead submit, Head review/publish, report
search, and PDF export. Then, as a Lead with an accessible report, open the
native Chat panel, ask a redacted question, confirm the answer shows only
authorized report sources, and open one source link. Confirm the panel's error
state is actionable if the provider is unavailable.

As an administrator, open **Settings → AI** and verify Overview shows safe
readiness, Provider shows the active profile/model without a credential, and
Features shows Report Assistant. Create a redacted behavioral draft, confirm
the locked core is read-only, review the composed prompt, and activate only
after current-contract validation passes. Restore and discard checks must leave the
other pointer and embedding state unchanged. **Settings → Integrations** must
show only external roadmapped services.

The runtime sends one fixed JSON Object Mode answer request and validates the
result with the shared server-owned answer schema. A failed runtime request is
reported safely rather than retried through another answer protocol. Provider
default reasoning omits the reasoning field; Off and Custom use only the
profile-specific bounded mapping validated during provider testing.

Automated tests must continue to use deterministic fakes or Playwright route
interception. They must never contact a real provider. Review the bounded metrics
without inspecting payloads:

```text
customreport_assistant_requests_total
customreport_assistant_duration_seconds
customreport_assistant_candidate_count
customreport_assistant_cache_events_total
customreport_assistant_repairs_total
customreport_assistant_tokens_total
customreport_ai_provider_state
customreport_ai_provider_capability_tests_total
customreport_ai_provider_preparation_completed
customreport_ai_provider_preparation_total
customreport_ai_provider_preparation_failed
customreport_ai_provider_preparation_elapsed_seconds
customreport_ai_provider_activations_total
customreport_ai_prompt_lifecycle_total
```

Check provider spend, request/token rate, 429s, timeouts, and error outcomes
against the production workspace budget. Investigate any metric or log label
that contains a question, answer, report content, ID, or name.

## 5. Rollback and incident handling

If the application release is unhealthy, roll back the application image to
the last compatible version and keep the additive database objects in place;
do not delete the extension/table or rewrite migration history. Restore the
previous application image only after its readiness and existing report-write
smoke checks pass.

If the provider is unavailable, preserve report writes and let the assistant
surface its explicit error state. Check egress, billing, model availability,
rate limits, retention/region approvals, and provider status before changing
code or configuration. A temporary provider outage is not permission to log
prompts or send report data to another endpoint.

To roll back a successful provider activation, use the admin Restore control on
the retained tested revision. To roll back prompt behavior, use Features →
Report Assistant → Restore on the retained current-serving bundle after it
passes the current serving-contract checks. The old active pointers remain
available until the replacement is ready; old embedding scopes are retained
for rollback and prompt-only restoration never rebuilds embeddings.

Record the deployment config version, migration decision, image digests,
preflight result, smoke result, metric review, and rollback decision in the
deployment system. Production databases are never reset.

## Provider test operations

Provider tests are accepted as durable jobs. The UI polls the stored `queued`,
`running`, and `completed` state, so a browser reload or request timeout does
not lose a test. A repeated request for the same immutable identity reuses its
existing run; if a queued row lost its first queue handoff, a later request
re-enqueues it. Generation checks run serially and omit sampling overrides such
as `temperature`, matching runtime.

Treat `inconclusive` as a retryable operational condition: inspect provider
availability, timeout, transport, or throttling before retrying. Only a
validated provider contract mismatch is `incompatible`; authentication or
authorization is a `configuration_error`. Do not change models or routes merely
to turn a test green.
