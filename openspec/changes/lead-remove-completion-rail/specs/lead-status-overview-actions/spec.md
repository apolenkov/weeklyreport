## REMOVED Requirements

### Requirement: Sticky completion Retry MUST be unavailable while an Overview update is open

**Reason**: The sticky completion rail is removed; completion actions render only in the header, whose Retry is already disabled while an Overview update is open.

**Migration**: None; the header cluster keeps the same pending-input guard.
