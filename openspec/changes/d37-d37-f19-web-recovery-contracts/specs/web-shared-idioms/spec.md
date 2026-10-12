## ADDED Requirements

### Requirement: Navigation consumers derive from the existing route owners

Web home-route exports MUST derive from ROLE_HOME_PATH. The named lead and viewer consumers MUST reuse the existing navigation route constants. Dev-login role/email URL encoding MUST have one shared pure builder; app login supplies its explicit role-home redirect and the role switcher omits redirect.

#### Scenario: Dev login callers retain wire policy

- **WHEN** app login or development role selection builds its URL
- **THEN** role and email use the same encoding owner
- **AND** only app login includes its explicit role-home redirect
