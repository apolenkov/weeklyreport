# Design

## Context

See proposal.md. The corrected v2 patch and external D37-V19 receipts are the reviewed implementation inventory. These deltas preserve the owning requirements in full and add scenarios for the accepted corrections.

## Decisions

Period-policy fields merge into the latest draft instead of a render-captured snapshot. PauseReasonDialog uses the existing shared safe-text bound on the value it already confirms, keeping the shared field presentation and dialog lifecycle.

Feedback detail retains all supplied rows and uses tuple content plus an occurrence counter for repeated diagnostics. Valid large viewport dimensions remain authoritative; only unusable dimensions take the existing display fallback. No renderer cap or ingress limit changes.

The existing edit form is keyed by record identity, so changing the selected record resets only that form's seeded text. Existing disclosure controls expose state. Each existing workflow owns a synchronous pending guard, released after failure; successful completion continues through its existing close callback. Server authorization, retry-safe create and durable lifecycle rules remain separate owners.

## Risks and verification

The diagnostics regression supplies 57 console and 25 network rows directly to the UI, exceeding the shared 50/20 boundary. It establishes preservation at the renderer, not shared-schema admission. Same-tick UI guards do not establish database idempotency. Author unit/format/lint receipts remain in D37-V19; native browser, assistive technology and persistence acceptance remain unverified.

## Migration

No schema, role, dependency, period lifecycle tuple or destructive-operation changes. Deliver the exact scoped patch through ordinary hooks. Root owns integrated six gates, native acceptance and the aggregate independent review; these deltas do not mark broader findings complete.
