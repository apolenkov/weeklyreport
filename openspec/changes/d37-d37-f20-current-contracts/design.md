# Design

## Context

Exact base b7525eb8788becd26233e0531c1a3ee75ee265f4 already contains client-log stream limits and common toolbar frame derivation. F20 contains eleven complete draft/original records; only C5313 belongs to the strict unresolved subset. See SCOPE-AND-RED-PLAN.md and structural-before.json in the durable handoff.

## Goals / Non-Goals

Preserve admitted input/output behavior while unifying live source owners and removing unreachable code. Correct only actual empty-print and Reference separator failures. Native geometry, cache, Unicode/IME and auth/CAS acceptance remain separate; no new runtime seams, policies, dependencies or arbitrary thresholds.

## Decisions

- Print data flow: public weekly schema → actual mapper → product collection → print renderer. Before, an empty array emitted a break/header; after, it returns null. Nonempty rendering is untouched and checked through the same mapper/consumer.
- Error flow: details/reference extraction unchanged; only the two defective branches append terminal punctuation when an existing reference follows. Internal/invalid-link/no-reference branches remain unchanged.
- Shared responder note: two independent numeric500 definitions → existing shared reopen schema export → both API input validation and UI label/maxLength. Existing wildcard index exports it. Search/report prose/Unicode length policies are independent and unchanged.
- Action icons use one private common-props object, preserving all public sizes/paths and Check override. Rail keeps three static slots and first-only XL override; tooltip reuses the current280 cap.
- Item status admission excludes blocked; covering risks remain the only stage alarm floor. Remove items parameter and all four caller arguments/coveringItems dead projection, preserve risk/collapse outputs. API cross-author algorithm unchanged; only obsolete comment corrected.
- Cache tag has no live invalidator. Remove only explicit unused tag, keep force-cache60, path revalidation, timeout, build fallback and error reporting. Native cache behavior is not inferred as executed.

## Risks / Trade-offs

Source P8 proofs are not fabricated failing UI tests. Existing behavioral owner tests protect consumer behavior; no private/source-string mirrors. Mocked transport/DOM/procedure tests do not prove print pagination, browser/AT, active geometry or DB/CAS. Root owns final source SHA acceptance and six gates. Canonical seven procedure builders including Lead, period lifecycle tuple and destructive guard are untouched. No migration, feature flag or restart is introduced.
