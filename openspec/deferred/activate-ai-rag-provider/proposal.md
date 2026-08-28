# Activate AI/RAG provider

## Problem

The AI Summary / RAG feature exists only as inert traces, with no concrete
provider selected. Phase 54 roadmap includes auto-summary of statuses and
extracted risks, fed by a RAG corpus ingested at report-publish time. Three
deferred-trace surfaces exist today and the durable deferred-feature-pattern
spec already reserves an "AI/RAG path is deferred" scenario, but Phase 54 is
the only deferred feature lacking an entry in `openspec/deferred/`.

What exists today (all inert, no working path):

1. Inert admin placeholder card: the "AI Summary" row in the integrations
   sub-tab is an `opacity-70` dashed `ComingSoonBadge` placeholder, with
   `Provider` shown as "not configured" and `RAG corpus` as "empty"
   (`apps/web/src/features/organization/ui/settings-integrations-sub-tab.tsx`).
   No live activation marker exists there today.
2. No publish-time ingestion seam exists in the MVP. The dormant hook and
   no-op queue were retired because they had no selected provider, owned
   outcome, or consumer. A future activation must own its integration design
   instead of coupling current publishing to a speculative feature.
3. Adapter-port pattern reference: the Telegram adapter token documents an
   `AI_ADAPTER` / `ai.adapter.ts` port pattern as the intended Phase 54 shape
   (`apps/api/src/modules/telegram/telegram.adapter.ts:43`). No `ai.adapter.ts`
   file exists yet, and no ingestion seam remains.

The provider itself is undecided: the placeholder names Anthropic / Yandex /
Llama as candidates (`settings-integrations-sub-tab.tsx:151`).

## Solution

1. Pick a concrete AI provider (Anthropic / YandexGPT / Llama) and an
   embedding model; record the choice.
2. Implement `ai.adapter.ts` with an `AI_ADAPTER` injection token, mirroring
   the `TELEGRAM_ADAPTER` port pattern referenced at
   `telegram.adapter.ts:43`.
3. Design and implement a product-owned publish integration only after defining
   its consistency, retry, privacy, and retention contracts; then embed
   published section content into a vector corpus on successful publish.
4. Implement the summary/extract-risk read path and surface it; replace the
   inert "AI Summary" placeholder with a real provider/corpus status.
5. Throw the loud stub `Error('Not implemented — see TODO(<ref>)')` at any
   still-deferred entry point until fully wired, per the deferred-feature
   pattern.

## Activation trigger

**Phase 54 milestone — when the team picks an AI direction.** The provider
choice (Anthropic / Yandex / Llama) is the gating decision; activate only once
that direction is chosen and Phase 54 is unlocked.

## Non-goals

- Choose the provider in this entry — that decision stays open until the team
  picks an AI direction.
- Add a runtime feature flag for the AI path; activation removes the
  `ComingSoonBadge` and loud stub entirely, per deferred-feature-pattern.
- Add new color tokens; the placeholder card reuses existing surface/border
  tokens.
- Translate any AI-related UI; production UI strings stay English.
- Build a director-facing AI workflow; director scope stays read-only.

## Status

Deferred — no live `TODO(<ref>)` marker or backend ingestion seam exists for AI
RAG activation. The integrations surface remains at
`apps/web/src/features/organization/ui/settings-integrations-sub-tab.tsx`. The
future activation change owns both its marker and its integration architecture.
