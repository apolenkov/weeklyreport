## ADDED Requirements

### Requirement: History toolbar holds its geometry while the session loads

While the session is unresolved, the History toolbar MUST render the resolved
toolbar's frame, padding, border, search slot and archive-toggle footprint. That
reserve MUST be invisible, inert and absent from the accessibility tree, and MUST
NOT render a role-scoped search. The toolbar and the History panel MUST keep the
same position and size (within 1 CSS pixel) between the loading and resolved
states at 375 and 1440 CSS pixels. A resolved archive count that changes the
toolbar's wrap state at an intermediate width is outside this guarantee.

#### Scenario: History resolves the session after first paint

- **WHEN** History mounts while the session is loading and the session then resolves to Lead, Head, Admin or Viewer at 375 or 1440 CSS pixels
- **THEN** the toolbar and the History panel keep their position and size within 1 CSS pixel
- **AND** no search box or archive toggle is focusable, clickable or announced before the role resolves
- **AND** the page records no layout-shift entry attributed to the toolbar or the History panel
