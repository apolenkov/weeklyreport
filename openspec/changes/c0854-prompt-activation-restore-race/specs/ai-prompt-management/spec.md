## ADDED Requirements

### Requirement: Concurrent prompt activation and restore settle as success or conflict

Activations and restores of one feature MUST serialize so that each settles
either as a coherent success or as the controlled activation conflict
(boolean `false`, surfaced as a domain conflict). A lock-order abort between
them MUST NOT reach the caller as an unexplained server error. After all of
them settle, exactly one revision of the feature MUST be active and the feature
pointer MUST name it. Database failures unrelated to this ordering, such as a
lost connection or a timeout, MUST propagate unchanged.

#### Scenario: A stale activation races a restore of the previous revision

- **GIVEN** a feature whose pointer names revision 1 and a draft revision 2
- **AND** an activation of revision 2 has read the pointer as revision 1
- **AND** a second activation of revision 2 commits first
- **WHEN** a restore of revision 1 runs while the first activation still holds revision 2
- **THEN** every activation and the restore return success or a controlled conflict
- **AND** exactly one revision is active and the feature pointer names it
