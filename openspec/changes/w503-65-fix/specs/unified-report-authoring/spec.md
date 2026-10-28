## ADDED Requirements

### Requirement: Won't do resolution MUST stay visible beside outcome history

A Product or Activity item with a Won't do resolution MUST show the resolution
actor and timestamp in its outcome history even when that history is non-empty
and does not contain the event referenced by `resolution.eventId`. History
events MUST NOT hide the resolution's audit fallback.

#### Scenario: Resolution actor and timestamp display with truncated history

- **WHEN** an item has a resolution and its outcome history does not contain the
  event that the resolution references
- **THEN** the resolution actor and timestamp remain visibly rendered in the
  outcome history alongside the other events

### Requirement: Inline editor navigation warning MUST follow unsaved input

An inline item editor MUST warn before page unload or in-app navigation only
while it holds unsaved changes. A pristine editor MUST NOT prompt.

#### Scenario: Inline editor navigation warning

- **WHEN** the inline editor is pristine
- **THEN** page unload and navigation proceed without confirmation
- **WHEN** the inline editor has unsaved changes
- **THEN** unload is prevented and in-app navigation asks for confirmation
