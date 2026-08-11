# Mistral integration for the Lead report assistant — research (2026-08-04)

Scope: official Mistral API access, TypeScript SDK, chat/tool-calling models,
embeddings, request behavior, and privacy facts relevant to internal weekly-report
content. Only first-party Mistral documentation, legal pages, Help Center, and the
`mistralai` GitHub organization are cited.

## Recommended baseline

Use these version-pinned model IDs for the first implementation and UAT:

| Purpose                            | Model ID             | Why                                                                                                                                               |
| ---------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search planning / function calling | `mistral-medium-3-5` | Its official model card lists Function Calling and Structured Outputs; the pinned ID avoids silent behavior changes from `mistral-medium-latest`. |
| Grounded final answer              | `mistral-medium-3-5` | The owner selected the same balanced general-purpose model to reduce configuration and evaluation combinations in v1.                             |
| Semantic embeddings                | `mistral-embed`      | This is Mistral's documented text-retrieval embedding endpoint; it returns 1,024-dimensional vectors.                                             |

Sources: [Mistral Medium 3.5 model card](https://docs.mistral.ai/models/model-cards/mistral-medium-3-5-26-04),
[function-calling guide](https://docs.mistral.ai/studio-api/conversations/function-calling),
[Mistral Embeddings API cookbook](https://docs.mistral.ai/resources/cookbooks/mistral-embeddings-embeddings).

`mistral-small-2603` is the cost-oriented UAT alternative: its model card also
lists Function Calling and Structured Outputs. It should replace Large only after
the same planner, citation, Russian-query, and prompt-injection evaluation suite
passes. Its published token prices are materially lower than Large 3's, but model
choice must be made from measured application quality rather than price alone.
[Mistral Small 4 model card](https://docs.mistral.ai/models/model-cards/mistral-small-4-0-26-03)

Before deployment, call `GET /v1/models` using the target workspace key and verify
that every configured ID is actually available to that workspace. The endpoint
returns the models accessible to the caller and their capability metadata.
[Models API](https://docs.mistral.ai/api/endpoint/models)

## Account, workspace, and API key

For a production-style setup:

1. Create or use a Mistral organization in Studio.
2. Activate billing for the organization. Mistral's workspace administration guide
   says workspace keys remain inactive until a payment method is on file.
3. Create separate development/UAT and production workspaces so keys, usage, and
   spending limits are isolated.
4. In **Studio → API keys**, select the target workspace, choose **Create new key**,
   name it descriptively (for example, `customreport-local`), and copy it immediately;
   the value is shown only once.
5. Set a workspace spending limit and monitor usage in the billing dashboard.
6. Store the value as `MISTRAL_API_KEY` in a local untracked environment file or a
   deployment secret manager. Never place it in Git, OpenSpec, logs, screenshots, or
   chat messages.

Mistral recommends separate development and production workspaces and documents the
key-creation, one-time display, billing, and spending-limit behavior in
[Manage workspaces and API keys](https://docs.mistral.ai/getting-started/quickstarts/admin/manage-workspaces).
The key can be verified without sending report content:

```bash
curl https://api.mistral.ai/v1/models \
  -H "Authorization: Bearer $MISTRAL_API_KEY"
```

For local development, the project's implementation should read the key through its
validated required-env mechanism. It must not copy the SDK README's illustrative
`?? ""` fallback: a missing key must fail boot explicitly under this repository's
configuration rules.

## Official TypeScript SDK

The official package is `@mistralai/mistralai`:

```bash
pnpm --filter @customreport/api add @mistralai/mistralai
```

The current SDK major is v2, is ESM-only, and uses Zod v4, which aligns with this
project's runtime and validation stack. The official repository documents
installation with pnpm, chat and embedding methods, retries, regional servers, a
custom Fetch-based HTTP client, and timeout/error hooks.
[Official TypeScript SDK](https://github.com/mistralai/client-ts)

Minimal client shape (illustrative, not a replacement for the project's adapter and
env validation):

```ts
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({
  apiKey: validatedEnv.MISTRAL_API_KEY,
  server: "eu",
});
```

The SDK currently distinguishes `global`, `eu`, and `us` servers; the EU server is
`https://api.eu.mistral.ai`. The application should make the endpoint/region an
explicit reviewed configuration decision rather than accept an invisible fallback.
[TypeScript SDK server selection](https://github.com/mistralai/client-ts#server-selection)

## Tool calling and structured output behavior

The planner should use Chat Completions with one function tool, `toolChoice: "any"`,
and `parallelToolCalls: false`:

- `auto` lets the model decide whether to call a tool;
- `any` forces a tool call but does not by itself select a particular tool;
- `none` prevents tool use;
- parallel tool calls are enabled by default and may arrive in any order.

Because this design exposes exactly one planner tool, `any` plus disabled parallel
calls gives the required single tool invocation. Mistral documents these semantics
in its [function-calling guide](https://docs.mistral.ai/studio-api/conversations/function-calling)
and [known limitations](https://docs.mistral.ai/resources/known-limitations).

Function calling does not execute application code. The model chooses a function
and produces its arguments; the application must parse, validate, authorize, and
execute them. The returned tool result can then be supplied to a later model call.
[Function-calling guide](https://docs.mistral.ai/studio-api/conversations/function-calling)

For the final grounded answer, prefer Custom Structured Outputs with the shared JSON
Schema/Zod-derived contract. Mistral states that custom structured output enforces a
supplied schema and is more reliable than plain JSON mode. Plain JSON mode guarantees
valid JSON but not adherence to a particular schema, and the prompt must explicitly
mention JSON to avoid an indefinite whitespace response.
[Custom Structured Outputs](https://docs.mistral.ai/studio-api/conversations/structured-output/custom),
[known limitations](https://docs.mistral.ai/resources/known-limitations)

These API constraints do not remove the need for application validation and the
single bounded repair attempt already designed for the assistant.

## Embeddings

Use:

```ts
await client.embeddings.create({
  model: "mistral-embed",
  inputs: texts,
});
```

The endpoint accepts one string or an array of strings. `mistral-embed` produces a
1,024-element vector for each input and is explicitly presented for semantic
retrieval. Therefore the initial configuration should be:

```text
AI_EMBEDDING_MODEL=mistral-embed
AI_EMBEDDING_DIMENSIONS=1024
```

Sources: [Embeddings API reference](https://docs.mistral.ai/api/endpoint/embeddings),
[Mistral Embeddings API cookbook](https://docs.mistral.ai/resources/cookbooks/mistral-embeddings-embeddings).

The current endpoint schema documents array input but does not publish a stable hard
maximum number of texts per synchronous request. An older official RAG cookbook notes
a 16,384-token aggregate limit as of May 2024; a newer official Codestral Embed
cookbook uses 128 inputs, 16,384 aggregate tokens, and 8,192 tokens per input for that
different model. These are useful safety signals, not a current contractual limit for
`mistral-embed`.
[Official RAG/Pinecone cookbook](https://docs.mistral.ai/cookbooks/third_party-pinecone-pinecone_rag),
[Codestral Embed cookbook](https://docs.mistral.ai/resources/cookbooks/mistral-embeddings-code_embedding)

Accordingly, keep document texts short by construction and make batch size a tested
server limit. A conservative project starting point is **32 texts per request** and
**8,000 aggregate input tokens**, with bounded backoff for `429` and no automatic
truncation of report facts. This is an application recommendation, not a limit claimed
by Mistral.

## Data handling and privacy gate

Weekly-report content is internal business data, so privacy configuration is a
release prerequisite, not an optional optimization:

- Mistral says Scale-plan Studio/API input and output are not used for model training;
  free-plan API data may be used unless the organization opts out in **Admin Console →
  Privacy → Anonymous improvement data**.
- Except for specific APIs, API input and output are retained for the time needed to
  generate the response and then for 30 rolling days for abuse monitoring, unless Zero
  Data Retention is activated.
- The standard API is hosted in the EU by default; selecting the US endpoint hosts data
  in the US. Some features may still involve temporary transfers to documented
  subprocessors.
- The customer retains ownership of input and owns output, but remains responsible for
  having the rights to submit the input and for evaluating output accuracy.

Sources: [Mistral training controls](https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training),
[training by plan](https://help.mistral.ai/en/articles/347617-do-you-use-my-user-data-to-train-your-artificial-intelligence-models),
[Privacy Policy, retention section](https://legal.mistral.ai/terms/privacy-policy),
[data location](https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data),
[Commercial Terms](https://legal.mistral.ai/terms/commercial-terms-of-service).

Before production traffic, the owner must record evidence that:

1. the production workspace is on the intended paid plan;
2. training is disabled for API data (or is non-applicable under that plan);
3. the desired retention posture is approved, and Zero Data Retention is activated if
   required by the project's data policy;
4. the selected endpoint/data region is approved;
5. no report text, prompts, tool results, or model outputs are captured by application
   logs or external observability payloads.

Do not use `labs-*` models for this feature. Mistral's Commercial Terms state that Labs
model data may be used for training unless Zero Data Retention is active, independently
of other opt-out preferences.
[Commercial Terms, Labs Models](https://legal.mistral.ai/terms/commercial-terms-of-service)

## Deployment facts to verify

- Outbound HTTPS must reach the explicitly selected Mistral host on port 443. If the
  deployment has an egress allow-list, allow only that host rather than a broad domain.
- Verify `MISTRAL_API_KEY` and all three configured model IDs during rollout with a
  no-report-content smoke test. Do not print the key or send report content from a
  deployment shell.
- Rate limits vary by subscription tier and model; Mistral enforces requests/second and
  tokens/minute independently and returns `429` when exceeded. Observe response rate
  limit headers and use bounded retries.
  [Known limitations](https://docs.mistral.ai/resources/known-limitations)
- The assistant should use ordinary Chat Completions, not the stateful Agents API: the
  Privacy Policy documents different retention for Agents API input/output, while this
  design requires a stateless, application-controlled flow.
  [Privacy Policy](https://legal.mistral.ai/terms/privacy-policy)

## Decision summary for the implementer

```text
MISTRAL_PLANNER_MODEL=mistral-medium-3-5
MISTRAL_ANSWER_MODEL=mistral-medium-3-5
MISTRAL_EMBEDDING_MODEL=mistral-embed
MISTRAL_EMBEDDING_DIMENSIONS=1024
```

The exact environment variable names may be aligned with the accepted OpenSpec, but
their values must remain explicit, required, validated at boot, and documented per
environment. The built-in Mistral profile uses the approved global endpoint. No
`-latest` alias, hidden SDK default, or free-plan privacy assumption should enter
the production configuration.

Method note: researched on 2026-08-04. Mistral model availability, pricing, API limits,
and legal terms are changeable external facts; re-check the linked primary sources and
`GET /v1/models` immediately before production rollout.
