## REMOVED Requirements

### Requirement: Post-run environment sweep is a deferred collector contract

**Reason**: The deferred driver timeline and four-channel collector contract belonged to the retired campaign architecture and was never a shipped product gate.

**Migration**: Keep logs, errors, and observability checks in focused deterministic or operational verification owned by their respective capabilities.

### Requirement: Channel liveness — blind is never clean

**Reason**: This requirement governed the unimplemented driver collector rather than an active WeeklyReport consumer.

**Migration**: Every surviving focused observability check must continue to distinguish unavailable evidence from a clean result within its own contract.
