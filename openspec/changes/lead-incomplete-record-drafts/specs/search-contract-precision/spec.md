## ADDED Requirements

### Requirement: Ordinary live search excludes incomplete content

Live `mine` and `all` search MUST exclude incomplete risks and decisions before ranking, snippets and limits, including the author's own incomplete rows. Existing role, group and excludeTypes rules MUST remain unchanged. Private draft recovery MUST NOT use ordinary search as its access path.

#### Scenario: Incomplete row would rank first

- **WHEN** an authorized live query matches an incomplete risk before a complete risk
- **THEN** only the complete risk consumes a result slot and neither title nor snippet reveals the incomplete text

### Requirement: Search disclosure describes the authorized corpus

Search responses MUST carry omission metadata separately from hits, including zero-hit results. The corpus MUST use the same authorized scope, lifecycle domain and included record kinds as the query, before text matching and result limits. Published scope uses frozen indexed metadata; live scope uses current rows. The notice MUST NOT assert an omitted row matched the text query.

#### Scenario: Live mine returns no text matches

- **WHEN** a Lead searches `mine` and their accessible search corpus contains two incomplete risks but no complete text matches
- **THEN** the response contains no hits and a known corpus omission count of two risks
- **AND** other authors' counts are absent and excluded record kinds contribute nothing

#### Scenario: No granted groups

- **WHEN** the existing search authorization yields zero groups
- **THEN** both hits and disclosure are empty without querying or revealing inaccessible report existence
