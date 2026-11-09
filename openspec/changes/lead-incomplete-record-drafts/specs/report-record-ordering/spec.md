## MODIFIED Requirements

### Requirement: Section writes recheck published identity under the Report lock

After locking and validating the parent Report, save and submit MUST resolve the section's current item and decision stable IDs against published lineage inside the same transaction. They MUST compare that authoritative lineage with the final merged section before the section version compare-and-set or any child-row deletion. Omitting a published identity MUST raise the existing typed `PUBLISHED_RECORD_LOCKED` denial and MUST write nothing. The lineage guard MUST permit omission of never-published identities; final replacement MUST additionally enforce explicit deletion intent for persisted incomplete risks and decisions under `report-section-write-gates`. Complete never-published decisions and draft-only items remain deletable without that intent.

A published decision retained in the final section MUST remain complete; making it incomplete MUST raise `PUBLISHED_RECORD_LOCKED` before CAS or child deletion with actionable Impact guidance. Risk lineage protection is not introduced. These checks preserve the current snapshot as a publication witness across reopen and republish without additional history storage.

#### Scenario: Publish and reopen finish after the save precheck

- **GIVEN** a save or submit precheck found no published lineage for the current section
- **AND** publish and reopen commit before the write transaction locks the Report without changing the section version
- **WHEN** the transaction rechecks lineage and the final section omits the newly published identity
- **THEN** it raises `PUBLISHED_RECORD_LOCKED`
- **AND** it does not increment the section version or delete child rows

#### Scenario: Final section preserves the newly published identity

- **GIVEN** the locked recheck resolves an item or decision as published
- **WHEN** the final merged section retains that stable ID
- **THEN** the lineage check passes
- **AND** the existing version compare-and-set and save flow continue

#### Scenario: Post-publication draft addition is removed

- **GIVEN** a reopened section contains an item or decision added after its latest publication
- **AND** no publication source contains that stable ID
- **WHEN** the final merged section omits the draft-only identity
- **THEN** the locked lineage check passes
- **AND** the draft-only row remains deletable

#### Scenario: Complete draft-only decision omission succeeds

- **WHEN** a valid current-version replacement omits a complete never-published decision
- **THEN** lineage permits omission and no incomplete-record deletion intent is required
- **AND** existing item and complete-row deletion behavior is unchanged

#### Scenario: Incomplete draft-only decision omission needs intent

- **WHEN** a current-version replacement omits an incomplete never-published decision without explicit kind and stableId deletion intent
- **THEN** lineage permits omission but final replacement rejects without mutation
- **AND** the row remains deletable by explicit authorized intent; the original draft-addition scenario describes lineage permission, not a bypass of this additional guard

#### Scenario: Retaining a published stableId is not permission to clear impact

- **WHEN** the final collection retains a published decision's stableId but clears its impact
- **THEN** identity preservation passes its subcheck but the complete-content guard rejects with `PUBLISHED_RECORD_LOCKED` before CAS or child clearing
- **AND** retaining the same decision complete allows the existing save flow to continue
