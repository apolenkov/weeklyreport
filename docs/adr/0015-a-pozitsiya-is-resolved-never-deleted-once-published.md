# Published records are resolved, never deleted

**Status:** accepted and implemented for items and decisions. Current contracts:
`openspec/specs/lead-form-loaded-view-model/spec.md` and
`openspec/specs/carry-over-automation/spec.md`.

An item or decision that has appeared in a published report cannot be deleted.
Its stable lineage remains available and the record is resolved or carried
forward instead. A record that has never been published may be deleted as a
draft correction. Risks are re-raised per period and are outside this published
lineage lock.

The write path preserves stable lineage across section recreation and
carry-over. `done` records completion; an audited Won't do records explicit
abandonment without deletion. Eligible planned commitments and unresolved
decisions carry automatically; paused, postponed and cancelled items require
explicit replanning. See [ADR 0018](0018-results-commitments-and-resolution-share-one-lineage.md)
for the separation between current results, commitments and resolution.
