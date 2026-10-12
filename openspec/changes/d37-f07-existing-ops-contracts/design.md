# Design

## Context

D37-F07 contains20 draft cards and26 complete original/recovered claims. Current published source fixes are retained as source checkpoints, without claiming native acceptance. SCOPE-AND-RED-PLAN.md identifies current admitted roots and controls. Correctness probes execute real public helpers/entrypoints with safe owned filesystem/process fixtures; setup failures stay separate.

## Goals / Non-Goals

Goals: retain primary failures, finish discovery before mutation, preserve recovery pre-state, enforce already-declared tool/lint boundaries and keep current documentation truthful.

Non-goals: new policies, dependencies/pins, live destructive operations, broad logging/fixture exemptions, proprietary harnesses, unmeasured optimization or author aggregate acceptance.

## Decisions

- Focus diagnostics become best-effort around only the secondary await/serialization; the same wait error object is rethrown. Abort/non-Error/success paths stay unchanged. RegExp names use a private clone reset per match, retaining sticky flags and leaving caller state intact.
- Helm errors/signals remain distinguishable from ordinary nonzero exit; diagnostics omit argument/value dumps. The actual child executable is exercised by EACCES/signal/normal controls.
- Prune data flow before: partial/caught discovery → resolve and delete interleaved. After: complete error-propagating discovery and removal planning → deletion. Allowed/shared/forbidden/orphan policy and isolated deploy-root guard stay unchanged; no rollback or concurrent-filesystem guarantee is invented.
- Reset retains one lock/trap owner. Original replicas are captured and validated before attempted scale-down; recovery restores the captured count, including failure. PF logs belong to this lifecycle and stay private. Required consumed secrets reject before any preparation or external mutation; trusted shell and password format policy remain.
- Accepted stop continues cleanup after delete failure, preserving primary status. Cancellation/target refusal stays no-op. Start distinguishes successful validated numeric count from malformed output; current zero/positive/failure semantics remain.
- ESLint uses one existing contour authority and the installed import-x resolved zone for runtime web/API edges; type-only syntax is the only narrow adapter exception. Product/named-test budgets and security/a11y checks are preserved.
- Literal compiler grammar is bounded; no shell evaluation. Generated CSS ignore and typography prose changes use current producer facts.

## Risks / Trade-offs

Mocked transport/shell and filesystem tests do not prove native browser, ingress, DB/reset/image or real process ownership. Caddy changes remain NE without pinned-image trusted/untrusted proof. Existing period lifecycle and seven canonical authorization builders including Lead are untouched. No migration/feature flag is required. Root owns native/aggregate gates, normal hooks/main and final independent review.
