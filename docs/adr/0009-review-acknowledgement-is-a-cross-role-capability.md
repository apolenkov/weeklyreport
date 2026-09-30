# Review and acknowledgement are cross-role capabilities

**Date:** 2026-06-30

**Status:** accepted and implemented.

## Decision

Review and acknowledgement are capabilities of existing roles, not a separate
access role. Heads and admins can review within their scope; designated viewers
may review groups where `ViewerGroupAccess.canReview` is enabled. Acknowledgement
requires group access.

A `changes_requested` verdict returns the submitted section to draft inside the
same optimistic-lock transaction as the review. Review never publishes, locks,
reopens, or archives a period. It affects only the section-level review state.

Current contracts: `openspec/specs/review-verdict-integrity/spec.md` and
`openspec/specs/review-acknowledge-placement/spec.md`.
