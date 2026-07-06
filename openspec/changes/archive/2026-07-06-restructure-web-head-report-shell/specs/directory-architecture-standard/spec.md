## ADDED Requirements

### Requirement: The head report shell MUST live in the report-sections slice

`head-report-shell.tsx` MUST reside at `apps/web/src/features/report-sections/ui/`
(filename unchanged from `components/head/`), because it is a report-sections
page-level shell composing report-shell primitives plus weekly-report/period/slides
UI — not a standalone `head` domain. The legacy `components/head/` directory MUST
NOT survive. Its route consumer under `app/(app)/head/report/[reportId]/` MUST
import it from `features/report-sections/ui/head-report-shell`. The relocation MUST
be behavior-neutral.

#### Scenario: The head shell lands in report-sections

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/features/report-sections/ui/head-report-shell.tsx` exists
- **AND** `apps/web/src/components/head/` no longer exists
- **AND** the head report route imports it from `features/report-sections/ui/*`
