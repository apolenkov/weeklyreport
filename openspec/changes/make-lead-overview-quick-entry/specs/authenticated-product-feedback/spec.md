## MODIFIED Requirements

### Requirement: Contextual feedback composition MUST remain operable inside the viewport

The pinned SitePing widget MUST retain drawn annotations, right-click comments,
screenshot capture, console/network diagnostics, marker visibility, its
standard sidebar, and deep links. Its contextual popup MUST calculate placement
from its rendered dimensions rather than a smaller fixed estimate, and MUST
remain bounded by the current viewport so its explicit Send and Cancel actions
are reachable. WeeklyReport application code MUST NOT query, move, resize, or
style SitePing's private injected DOM.

#### Scenario: A tall region leaves insufficient space above and below

- **WHEN** an authenticated user draws a region that occupies most of a 1728x962 viewport
- **THEN** the popup is clamped inside the viewport using its rendered height and width
- **AND** an enabled explicit Send button is visible and clickable
- **AND** keyboard submission remains a secondary accelerator rather than the only visible path

#### Scenario: The popup renders in a narrow or short viewport

- **WHEN** popup content approaches the available viewport dimensions
- **THEN** the popup box remains within 8 px viewport gutters and its actions remain reachable
- **AND** the underlying document does not gain horizontal overflow

#### Scenario: WeeklyReport initializes contextual feedback

- **WHEN** the application mounts the SitePing widget
- **THEN** it configures only the package's supported public API
- **AND** the package-owned popup performs its own measured placement
