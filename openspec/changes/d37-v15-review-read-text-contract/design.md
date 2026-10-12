# Design

## Context

See proposal.md and the existing same-column format rule in schema-conventions. The actual API comment result and report-section persistence projections consume the shared review views. Ingress already validates comment text through safeText with the review-specific 2000-character limit.

## Decisions

Before: stored comment → raw min1 view → report clients, while command input → bounded visible/null-byte guard → persistence. After: command and read fields reuse one private reviewCommentTextSchema with the existing review limit. The verdict command retains its leading trim pipe; the read contracts never normalize stored values.

Use the existing shared module and constant. No public export or wrapper is needed. Required record text stays required; present verdict comment is guarded while absent legacy reason remains valid. Reviewer display names have a different owner and are unchanged.

The existing review.schema.test is the primary parser owner: malformed values vary only the relevant field of independently valid fixtures. It also retains exact 2000, multiline/padding, approval-without-reason and legacy absence controls. Actual malformed mapped-read and normal/legacy public feedback acceptance belong to Root's guarded integration/browser phase.

## Risks / Trade-offs

- Historical malformed text may now make a read fail → retain its evidence and use Root-authorized scoped recovery; no trimming, truncation, fallback or automatic data repair.
- Accidentally tightening legacy absence changes reviewed history → keep the optional view field and its existing control.
- Accidentally moving trim onto shared read fields destroys stored bytes → exercise both read fields with multiline surrounding-space values.
- Same private schema must not alter input semantics → retain all existing verdict tests and the verdict-only trim pipe.

Period lifecycle atomicity, review authorization/version/CAS, snapshot comment privacy and destructive guards remain unchanged. No migration or runtime configuration change is needed. CLS threshold, null-next-step, name/case policy and performance hypotheses are outside this correction.
