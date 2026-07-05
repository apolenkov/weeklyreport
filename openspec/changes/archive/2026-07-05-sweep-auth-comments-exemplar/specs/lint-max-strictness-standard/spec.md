## ADDED Requirements

### Requirement: The auth module is the comment-policy calibration exemplar

The `apps/api/src/modules/auth` folder MUST be maintained as the reference
exemplar of the three-line WHY comment budget and the relocation-before-compression
rule: across every source file in the folder, each comment either states a
non-obvious WHY within budget or names its covering `openspec/specs/` requirement,
and the folder MUST carry no what-narration, no change-log/ticket/phase archaeology,
and no JSDoc on app-internal (non cross-package-public) declarations. Establishing
this state is a comment-only change that MUST NOT alter runtime behavior, exports,
or signatures, and — because the folder is a security-sensitive path — MUST pass
the auth security review before merge. Any over-budget comment whose covering
requirement is not yet durable in `openspec/specs/` MAY be retained verbatim; that
retention is the relocation-before-compression rule in action, NOT a violation, and
the pending compression MUST remain a tracked task rather than a silent deletion.

#### Scenario: over-budget rationale already homed in a spec compresses to a pointer

- **GIVEN** an over-budget WHY comment in the folder whose protective rationale is
  already required durably by a requirement under `openspec/specs/`
- **WHEN** the calibration sweep processes that comment
- **THEN** the block compresses to at most two lines optionally naming that
  covering requirement, and any co-located change-log/ticket/phase archaeology is
  deleted
- **AND** no runtime behavior, export, or signature changes

#### Scenario: rationale with no durable spec home is retained, not compressed

- **GIVEN** an over-budget WHY comment in the folder whose covering requirement is
  not yet durable under `openspec/specs/`
- **WHEN** the sweep reaches that comment
- **THEN** the comment is retained verbatim rather than compressed to a
  spec-pointer that would dangle for a reader grepping `openspec/specs/`
- **AND** compression stays a tracked task, gated on the covering requirement first
  becoming durable under `openspec/specs/`

#### Scenario: a live-bug guard comment is kept, corrected, and budget-trimmed

- **GIVEN** a comment in the folder that guards a cross-package divergence the code
  cannot express and points at the sibling declaration that must stay in sync
- **WHEN** the sweep processes it
- **THEN** the comment is kept within budget, with its file reference corrected to
  the declaration it actually guards, because it protects a live divergence rather
  than narrating the code

#### Scenario: the comment-only auth sweep passes security review before merge

- **GIVEN** a comment-only diff over `apps/api/src/modules/auth`
- **WHEN** the change is prepared for merge
- **THEN** it passes an auth security-review pass, and any finding that a
  compressed comment dropped an unspecced protective rationale blocks the merge
  until relocation completes
