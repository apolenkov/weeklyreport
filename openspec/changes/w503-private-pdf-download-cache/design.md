# Design

## Context

See proposal.md for the bounded C1126 cache-header gap. `mountApiIngress` mounts the shared handler at `/pdfs/:file`. Existing successful-stream coverage reads a real artifact through the handler into a Writable response and records headers and bytes.

## Decisions

Set one Cache-Control header beside Content-Type and Content-Disposition immediately before piping the artifact. Extend that successful owner-boundary test with one header assertion; no production seam or second harness is needed.

Before: authenticated requester, completed canonical job, generation file, response metadata, stream. After: the same flow with an explicit private no-storage policy in the response metadata.

## Risks / Trade-offs

This change declares cache behavior but does not prove every browser or intermediary obeys it or reproduce an actual unauthorized cached read. Existing cache copies are not purged. Global Helmet continues to own nosniff; no attachment filename policy is introduced.

Frozen requester authorization, completed-generation resolution, symlink refusal, response-close cleanup, and read-error handling remain intact. No period tuple, authorization-builder, or destructive-database contract changes or migration are needed.
