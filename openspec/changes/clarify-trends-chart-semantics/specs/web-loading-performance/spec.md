## REMOVED Requirements

### Requirement: Heavy packages and chart chunks are loaded through narrow entry points

**Reason**: Recharts and the Trends chart chunks are removed. Their dynamic-load scenario no longer exists.

**Migration**: Preserve narrow imports and query-local loading through the replacement table requirement below; no chart-only dependency or fallback remains.

## ADDED Requirements

### Requirement: Heavy packages and Trends tables use narrow entry points

The Next.js web build MUST optimize imports for `lucide-react`. Trends MUST import its concrete table modules directly rather than evaluating a UI barrel or requesting client-only chart chunks. Pending Trends queries MUST retain local query-loading skeletons named Loading data without hiding ready sibling sections.

#### Scenario: Trends renders ready and pending sections

- **WHEN** one Trends query is ready while another remains pending
- **THEN** the ready section renders its directly imported table
- **AND** only the pending section shows its local query-loading skeleton
