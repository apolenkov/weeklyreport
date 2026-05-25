## Purpose

The AI module at `apps/api/src/modules/ai/` is a bounded context that wraps all
LLM interactions. It MUST prevent PII leakage into LLM context windows through
three layered controls: a facade that blocks direct Prisma access, a token-budget
guard enforced before every call, and a sanitize layer that redacts sensitive
patterns before any payload reaches the provider.

Consumer surfaces: `apps/api/src/modules/ai/` (bounded context),
`apps/api/src/modules/ai/facade.ts` (data-access boundary),
`apps/api/src/modules/ai/sanitize.ts` (redact layer),
`eslint.config.js` (import-ban rule).

## Requirements

### Requirement: Facade Enforces No Direct Prisma Access

The AI module MUST NOT import `@prisma/client` directly. All data access from AI
code MUST go through `apps/api/src/modules/ai/facade.ts`. An ESLint rule MUST
flag any direct `@prisma/client` import inside `apps/api/src/modules/ai/` as an
error at lint time.

#### Scenario: Direct Prisma import inside the AI module

- **WHEN** a file under `apps/api/src/modules/ai/` contains `import { PrismaClient } from '@prisma/client'`
- **THEN** `pnpm lint` fails with an error referencing the `no-prisma-in-ai-module` (or equivalent) ESLint rule

#### Scenario: Data access goes through the facade

- **WHEN** AI code needs a `ReportSection` record and calls `AiFacade.getSection(id)`
- **THEN** the facade resolves the record via its injected Prisma repository and returns a typed DTO — no raw Prisma type escapes the facade boundary

### Requirement: Token Budget Guard Rejects Over-Limit Calls

Before any LLM call, the AI module MUST consult a token-budget guard that enforces
a 50 000 token/hour ceiling per requesting user. Calls that would exceed the budget
MUST be rejected with `AiBudgetExceededError` before the provider is contacted. The
guard MUST persist per-user hourly counters in Redis with a TTL of one hour; it MUST
NOT silently truncate the payload to fit.

#### Scenario: User has consumed exactly 50 000 tokens in the current hour

- **WHEN** a user whose hourly counter equals 50 000 triggers a new LLM call
- **THEN** the AI module throws `AiBudgetExceededError` without making any provider request and the Redis counter is not incremented

#### Scenario: Redis counter expires after one hour

- **WHEN** a user's Redis key TTL reaches zero
- **THEN** the guard resets the counter to 0 for the next call, allowing up to 50 000 tokens again in the new hour window

### Requirement: Sanitize Layer Redacts All Outbound Payloads

Every payload sent to an LLM MUST pass through `apps/api/src/modules/ai/sanitize.ts`,
which applies 8 redact patterns: email address, phone number, JWT, API key, password
field value, SSN-like number, bearer token, and internal hostname. TypeScript types
MUST make it impossible to pass an unsanitized string to the provider send function;
there is no runtime bypass or "raw send" escape hatch in the public API.

#### Scenario: Payload contains an email address

- **WHEN** a `ReportSection` draft passed to the AI module contains `user@example.com`
- **THEN** `sanitize()` replaces the email with `[REDACTED_EMAIL]` before the payload reaches the provider client

#### Scenario: Attempt to call provider send with an unsanitized string

- **WHEN** code attempts to call the provider send function with a plain `string` instead of a `SanitizedPayload` branded type
- **THEN** `pnpm typecheck` fails with a type error — no runtime workaround exists

### Requirement: Provider Errors Are Contained as Domain Errors

The AI module MUST translate provider errors — including rate-limit (HTTP 429),
timeout, and content-policy rejection — into typed domain errors before propagating
to tRPC. Raw provider error messages, stack traces, or HTTP response bodies MUST NOT
reach the tRPC error mapper or the client.

#### Scenario: Provider returns a rate-limit response

- **WHEN** the LLM provider returns HTTP 429
- **THEN** the AI module throws `AiRateLimitError` (a domain error extending `Error`), and `apps/api/src/infrastructure/trpc/trpc.error-mapper.ts` maps it to a tRPC `TOO_MANY_REQUESTS` code with a generic client-safe message

#### Scenario: Provider returns a content-policy rejection

- **WHEN** the LLM provider rejects a payload due to content policy
- **THEN** the AI module throws `AiContentPolicyError` containing only the policy category (no raw provider body), and the tRPC error mapper exposes only that category to the client
