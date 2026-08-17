## ADDED Requirements

### Requirement: Dashboard queue actions do not shift during disclosure

At desktop width, every Dashboard queue row MUST reserve stable compact tracks for its primary action and Details toggle. Changing `Details` to `Less` MUST NOT move either control horizontally, while the expanded detail content MAY increase only the row height.

#### Scenario: Head expands and collapses a lead row

- **WHEN** the Head toggles a queue row from Details to Less and back
- **THEN** the primary action and disclosure toggle retain their exact horizontal coordinates
- **AND** the disclosure remains keyboard-focusable and linked to its detail region

### Requirement: Dashboard queue skeleton preserves loaded-row geometry

The Dashboard queue skeleton MUST reserve the same desktop action tracks, control height, and summary-row minimum height as the loaded queue.

#### Scenario: Dashboard data finishes loading

- **WHEN** queue skeleton rows are replaced by loaded lead rows
- **THEN** the queue frame and action tracks retain their geometry
- **AND** the transition does not shift adjacent controls because of label width
