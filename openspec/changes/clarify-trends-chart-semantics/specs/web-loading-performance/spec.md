## MODIFIED Requirements

### Requirement: Heavy packages and Trends tables use narrow entry points

The Next.js web build MUST optimize imports for `lucide-react`. Trends MUST import its concrete table modules directly rather than evaluating a UI barrel or requesting client-only chart chunks. Pending Trends queries MUST retain local query-loading skeletons without hiding ready sibling sections.

#### Scenario: Trends renders ready and pending sections

- **WHEN** one Trends query is ready while another remains pending
- **THEN** the ready section renders its directly imported table
- **AND** only the pending section shows its local query-loading skeleton
