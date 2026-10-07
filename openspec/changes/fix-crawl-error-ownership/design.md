## Context

See proposal.md and accepted tickets. Existing consumers are loadPasswords before browser creation, createBrowser in worker/scenario, login in worker/scenario, and drainLogs plus visitWithRecovery in quick/full traversal.

## Decisions

Keep ENOENT environment fallback and existing password parser. Rethrow other read errors with cause/path without contents. Apply configured bootstrap bounds; salvage nonzero stdout only after complete batch protocol validation, otherwise rethrow the original child-process error. Do not put CLI input or credentials in added diagnostics.

Keep login retry ownership and rate reservations; retain attempt causes and sleep only before an actual next attempt. Share a small page retry diagnostic helper so quick/full retain both causes and discard abandoned findings consistently. Drain sources in two phases: report successful reads, clear exactly those sources and report each failure.

## Risks / Trade-offs

Preserving errors must not expose form contents: report auth role, count and a safe cause rather than command inputs. External CLI tests use isolated executable fixtures and timeout signals, without product database or browsers. Product lifecycle, role coverage and database guards are unchanged; no migrations or rollout settings.
