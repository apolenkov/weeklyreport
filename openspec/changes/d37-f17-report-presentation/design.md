## Context

The current producers derive publish eligibility from submitted section count and render canonical mapped products, with a submitted-only display filter and separate per-lead contributions. Chat accepts a schema-valid string answer, which need not contain paired markers.

## Goals / Non-Goals

Repair those existing observable contracts at their current owners. Preserve role/lifecycle gates, local dialog primitives, stable IDs, full-truth overview summaries, explicit overview navigation, and the supported finite Markdown grammar. No CommonMark expansion or native accessibility claim.

## Decisions

Reset only the local publish dialog state on eligibility loss. Keep `open && canPublish` and close-before-mutate safeguards.

Use `accordion.products` in Product scope; in Leads use the focused author's visible `leadGroups` entry. Reuse the existing content predicate and target fields. A global co-owner aggregate does not prove that author's panel exists.

Keep the split-based inline renderer and key generation. Only odd segments with a following closing delimiter become strong; unmatched odd tails regain their literal opening marker.

For mechanical changes reuse existing constants, preserve exact class token sets and messages, and delete only inputs never read. Item at-risk rails remain neutral; Risk/Escalation rails remain amber.

## Risks / Trade-offs

DOM tests cover current producers and public rendered boundaries, not native browser geometry, assistive technology, API or concurrent clients. These remain explicit needs-evidence clauses in the handoff.
