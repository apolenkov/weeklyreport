## Purpose

Keep CustomReport desktop pages visually coherent, grounded, and stable during primary navigation without changing their data or compact-layout behavior.

## ADDED Requirements

### Requirement: Desktop primary navigation preserves the complete application frame

Primary navigation between History, Dashboard, and Status MUST leave the desktop viewport at the top of the document with the complete application header visible. The route transition MUST NOT focus-scroll `main#main-content` beneath the persistent header, while the skip link MUST retain a programmatically focusable main target.

#### Scenario: Head changes primary route at the top of the page

- **WHEN** a head activates History, Dashboard, or Status from the desktop navigation while `window.scrollY` is zero
- **THEN** the destination renders with `window.scrollY` still zero
- **AND** the navigation header remains fully visible above `main#main-content`

### Requirement: Decorative desktop background never carries product meaning

Application desktop routes MUST use a restrained decorative background layer that is visually subordinate to card surfaces. The decoration MUST be CSS-only, MUST expose no semantic content or interaction, MUST preserve foreground contrast, and MUST NOT animate.

#### Scenario: Decorative shapes are unavailable

- **WHEN** CSS background decoration is disabled or ignored by assistive technology
- **THEN** every page retains the same information, controls, reading order, and completion status

### Requirement: Desktop application frame stays aligned and usable

The desktop navigation and primary application pages MUST share the same content width. At the showcase desktop width, the Head report context toolbar MUST keep the period and trailing control clusters on one row without hiding their visible labels.

#### Scenario: Head opens the complete slides toolbar

- **WHEN** the Head views slides with scope, view, deferred template, and density controls visible
- **THEN** the navigation, toolbar, and report content share aligned outer edges
- **AND** the context controls remain on one row without replacing their text labels with icon-only controls

### Requirement: Empty History aligns with its summary rail

The `/reports` desktop empty state MUST occupy the same visual grid row as History Summary and Submission Status. It MUST present one centered empty-state message without leaving a short detached placeholder above unused grid space.

#### Scenario: Compiled history has no current entries

- **WHEN** `/reports` renders no current history at a desktop width
- **THEN** the empty-state panel and the complete summary rail share aligned top and bottom grid boundaries
- **AND** no fabricated report data or action is shown

### Requirement: Visual acceptance covers every affected desktop surface

The change MUST be accepted only after source-bound screenshots and direct interaction checks cover Head History, Dashboard, Status form, Status slides in Product and Leads scope, plus the shared Lead report control hierarchy.

#### Scenario: Desktop composition is submitted for acceptance

- **WHEN** implementation is complete
- **THEN** a fresh manifest identifies the exact source SHA, route, role, state, and viewport for every required screenshot
- **AND** an independent reviewer inspects the complete fresh set
