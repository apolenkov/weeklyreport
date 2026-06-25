## REMOVED Requirements

### Requirement: Viewer visibility stays published-only

**Reason**: The viewer is being changed from a published-report consumer to a
status observer of the **current period** (ADR 0007). The viewer read is now gated
**published-or-current** (it sees the current `open` / `reopened` period live,
drafts included), so the "viewer sees a report only when its period is published"
constraint no longer holds. The new viewer read gate is specified in
`viewer-report-navigation`. The head and lead draft-visibility requirements in this
capability are unchanged.
