## ADDED Requirements

### Requirement: The review comment list MUST live in `shared/ui`, not a feature slice

The display-only review comment list MUST reside at
`apps/web/src/shared/ui/review-comment-list.tsx` (filename unchanged from the
legacy `components/review/` tree), because it is consumed by two different slices
— `weekly-report` and `report-sections`/lead — which trips the web rule-of-2 and
cannot be satisfied by either slice importing the other (zone 5). The legacy
`components/review/` directory MUST NOT survive the relocation. Consumers MUST
import `ReviewCommentList` directly from `shared/ui/review-comment-list` — no
barrel. The relocation MUST be behavior-neutral.

#### Scenario: The comment list lands in the shared ui layer

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/shared/ui/review-comment-list.tsx` exists
- **AND** `apps/web/src/components/review/` no longer exists
- **AND** the file resides under `shared/`, not under any `features/<domain>` slice

#### Scenario: Both slice consumers import it directly from shared

- **WHEN** the weekly-report `record-comments` or the lead `lead-review-feedback`
  component renders the comment list
- **THEN** it imports `ReviewCommentList` from `shared/ui/review-comment-list` directly
- **AND** no code imports `components/review/*`
