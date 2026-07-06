## ADDED Requirements

### Requirement: The viewer report shell MUST form its own `features/viewer` slice

`viewer-report-shell.tsx` MUST reside at `apps/web/src/features/viewer/ui/`
(filename unchanged from `components/viewer/`), as `viewer` is a standalone
canonical domain in the grouping rules. The legacy `components/viewer/` directory
MUST NOT survive. Its route consumer under `app/(app)/reports/[reportId]/` MUST
import it from `features/viewer/ui/viewer-report-shell`. The relocation MUST be
behavior-neutral.

#### Scenario: The viewer shell forms the viewer slice

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/features/viewer/ui/viewer-report-shell.tsx` exists
- **AND** `apps/web/src/components/viewer/` no longer exists
- **AND** the reports viewer route imports it from `features/viewer/ui/*`
