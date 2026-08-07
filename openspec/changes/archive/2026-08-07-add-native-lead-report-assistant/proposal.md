## Why

Leads can retrieve weekly-report facts only by manually navigating periods and sections; they need a native chat entry point that answers questions across the current draft and recent published reports without weakening the existing Lead visibility rules. The current full-text search (`apps/api/src/modules/search/**`) and Lead report surface (`apps/web/src/features/report-sections/**`) provide the integration anchors but do not offer parameter-aware or semantic report retrieval.

## What Changes

- Add a Lead-only report assistant opened from a Chat control beside Agent Review, visually and behaviorally native to the existing report surface.
- Retain the single active question, draft input, request state, and result in memory when the Sheet closes or the Lead navigates within the authenticated application; do not create conversation history or durable browser/server storage.
- Convert a natural-language question into a strict shared search plan, resolve accessible entities, and retrieve report facts using exact filters.
- Search the current editable live report and immutable published snapshots, defaulting to self and supporting explicitly selected visible co-leads.
- Add optional pgvector ranking only after authorization and structured filtering; vector data remains a content-addressed ranking cache, never a report source.
- Produce deterministic counts/comparisons and grounded answers with validated citations, explicit truncation, clarification, no-result, indexing-pending, and oversized-result states.
- Add Mistral language-model and embedding adapters behind internal ports, with required fail-fast configuration and no real-provider calls in CI.
- Add bounded read-through plus an idempotent BullMQ embedding worker without coupling report saves to AI availability.

### Non-goals

- Head, admin, or viewer assistant access.
- Fuzzy/transliterated entity matching, persistent chat history, ANN indexes, saved generated answers, or replacement of the existing `search.query` behavior.

## Capabilities

### New Capabilities

- `lead-report-assistant`: Native Lead chat interaction, grounded responses, clarification, citations, and result states.
- `authorized-report-retrieval`: Typed planning, live/snapshot selection, Lead ACL parity, exact filtering, candidate projection, aggregation, and semantic-after-structured retrieval.
- `semantic-embedding-cache`: pgvector storage, freshness, complete-set ranking, bounded read-through, and background indexing.

### Modified Capabilities

- `directory-architecture-standard`: Reclassify `search` as invariant-bearing and permit its internal domain/application/infrastructure split.
- `lead-toolbar-presentation`: Add the native Chat control beside Agent Review without disturbing toolbar layout or established control styling.

## Impact

Touches shared Zod contracts, the API search module and tRPC composition, Lead report UI, Prisma/init migration, PostgreSQL images, BullMQ, environment configuration, observability, integration/E2E fixtures, and deployment secrets. The MVP reset workflow may reshape the single init migration; production data must never be reset. Existing report writes, `search.query`, roles, and published-report behavior remain backward-compatible.
