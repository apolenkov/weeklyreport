## MODIFIED Requirements

### Requirement: Review comment composition MUST enforce the shared text boundary locally

The review-comment composer MUST expose an associated 2,000-character limit
derived from the shared review schema. The boundary MUST measure the text the
composer submits: leading and trailing whitespace is not part of the comment, so
the associated counter, the empty/invisible check and the length check MUST all
use the draft's trimmed value while the raw draft stays visible and editable.
Empty or invisible-only comments and comments over the limit MUST block mutation
with concise field feedback. A comment mutation MUST carry exactly the validated
text, without a second normalization step. Over-limit input MUST remain
available for correction, and serialized server validation details MUST NOT be
displayed to the user.

#### Scenario: A reviewer pastes an over-limit comment

- **WHEN** a reviewer pastes 2,001 characters into a review comment
- **THEN** the complete draft remains visible with associated limit feedback
- **AND** no comment mutation runs

#### Scenario: A reviewer submits a boundary-valid comment

- **WHEN** a reviewer submits 2,000 visible characters
- **THEN** exactly one comment mutation carries the valid anchor and full text

#### Scenario: Surrounding whitespace does not change the submitted comment

- **WHEN** a reviewer enters a draft whose trimmed content fits the limit but
  whose raw length exceeds it only by surrounding whitespace
- **THEN** the counter and the field feedback describe the trimmed payload and
  the composer admits the comment
- **AND** the mutation carries that trimmed payload while the raw draft stays
  visible

#### Scenario: Server validation rejects a comment

- **WHEN** the comment mutation returns serialized validation details
- **THEN** the composer preserves the draft and shows concise user-facing feedback
- **AND** raw serialized validation output is not rendered
