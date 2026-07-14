## ADDED Requirements

### Requirement: Scoped Match Uses Identity-Boundary Matching, Not Bare Substring

The scoped match in `isUniqueViolation` MUST NOT rely on bare substring
containment (`identity.includes(...)`) alone to compare a scope's `index`
name or `columns` entries against the serialized error identity. It MUST use
a boundary-aware comparison (e.g. matching the identifier surrounded by
non-identifier characters, or matching the quoted form the database/driver
actually emits) so that one constraint or column name being a textual
substring of an unrelated identifier cannot cause a false match.

#### Scenario: A substring collision does not cause a false match

- **GIVEN** a P2002 whose identity string contains an unrelated constraint
  name that happens to contain a scope's `index` or a `columns` entry as a
  substring
- **WHEN** the scoped `isUniqueViolation` inspects it
- **THEN** it returns `false`
- **AND** the caller re-throws the original error, exactly as it would for
  any other unrelated P2002
