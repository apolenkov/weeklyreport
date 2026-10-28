## MODIFIED Requirements

### Requirement: Review comment composition MUST enforce the shared text boundary locally

The review-comment composer MUST expose an associated 2,000-character limit derived from the shared review schema. Empty or invisible-only comments and comments over the limit MUST block mutation with concise field feedback. Over-limit input MUST remain available for correction, and serialized server validation details MUST NOT be displayed to the user. Submission MUST guard synchronously against same-tick duplicate submissions.

#### Scenario: A reviewer pastes an over-limit comment

- **WHEN** a reviewer pastes 2,001 characters into a review comment
- **THEN** the complete draft remains visible with associated limit feedback
- **AND** no comment mutation runs

#### Scenario: A reviewer submits a boundary-valid comment

- **WHEN** a reviewer submits 2,000 visible characters
- **THEN** exactly one comment mutation carries the valid anchor and full text

#### Scenario: Server validation rejects a comment

- **WHEN** the comment mutation returns serialized validation details
- **THEN** the composer preserves the draft and shows concise user-facing feedback
- **AND** raw serialized validation output is not rendered

#### Scenario: Two same-tick submits trigger only one mutation

- **GIVEN** a review-comment composer with valid text
- **WHEN** the submit action is triggered multiple times in the same tick before state re-render
- **THEN** exactly one comment mutation is dispatched
- **AND** subsequent same-tick submit calls are ignored by the synchronous guard
