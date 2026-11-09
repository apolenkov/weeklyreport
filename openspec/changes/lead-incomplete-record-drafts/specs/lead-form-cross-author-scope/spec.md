## ADDED Requirements

### Requirement: Incomplete record content is author-private

Head/admin cross-author reads, co-lead reads and Everyone projections MUST remove incomplete risks and decisions before status derivation or response serialization. Existing group and shared-product policies MUST also scope omission metadata. Author-only nullable reads MUST satisfy the all-route current-role policy in `lead-retained-incomplete-records`; authorship alone is insufficient. Ordinary reviewer reads MUST NOT gain private recovery access.

#### Scenario: Head inspects another author's draft

- **WHEN** an authorized Head opens another author's section with an incomplete blocker
- **THEN** the text, detail fields, identity and comments of that blocker are absent
- **AND** its authorized omission count is separate from complete risk content and status

#### Scenario: Everyone and co-owner share one Product

- **WHEN** a co-lead sees one shared Product but not the author's other Products or Activities
- **THEN** both lenses disclose only that shared Product's incomplete-record count without draft content
- **AND** neither the full section omission total nor private Activity counts escape the lens
