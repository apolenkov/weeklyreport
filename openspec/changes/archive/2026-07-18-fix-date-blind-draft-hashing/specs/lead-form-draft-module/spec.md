## ADDED Requirements

### Requirement: Stable serialization MUST distinguish payloads that differ only by Date value

The Lead Form draft hashing function (`stableStringify`) MUST serialize a
`Date` value into a form that differs whenever the underlying instant
differs, so that dirty-state detection and content-based record identity
never collapse two distinct dates into the same key.

#### Scenario: Deadline-only edit marks the autosave payload dirty

- WHEN the current draft payload and the last-saved payload are identical
  except that one field is a `Date` and its value has changed
- THEN `stableStringify` produces different keys for the two payloads
- AND the autosave hook's `dirty` flag becomes `true`

#### Scenario: Same-text decisions with different deadlines keep distinct content keys

- WHEN two decision records have identical text but different `deadline`
  `Date` values and neither carries a `stableId`
- THEN `recordContentKey` produces a different key for each record
- AND `reconcileSavedIdentities` does not swap their `id`/`stableId` between
  them during save-identity reconciliation

#### Scenario: Non-Date fields are unaffected

- WHEN a payload contains only primitive, array, or plain-object fields (no
  `Date`)
- THEN `stableStringify`'s output is unchanged from its current behavior
