## MODIFIED Requirements

### Requirement: Pending verdicts MUST be counted and MUST block submission

Unconfirmed suggested continuations MUST count as pending review. Lead Report completion actions MUST show `n to review` above zero and block Submit through the existing unconfirmed-carried-item rule. The count MUST work in header and non-overlay rail presentations without requiring Save. Paused and postponed prior items MUST NOT count as pending.

#### Scenario: Submit with pending items

- **WHEN** two suggested continuations remain unconfirmed
- **THEN** completion actions show `2 to review` and Submit is blocked with the existing explanation
- **AND** after both are confirmed the counter disappears and Submit becomes available under the remaining canonical eligibility checks
- **AND** no permanent Save control or fixed overlay is required to review them
