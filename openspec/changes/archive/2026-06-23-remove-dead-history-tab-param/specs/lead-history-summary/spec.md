# lead-history-summary delta — remove the dead `tab` nav param

## ADDED Requirements

### Requirement: History navigation links carry no tab parameter

The NavBar History link MUST target `/reports` with no `tab` query parameter
for every role that sees it (lead, head, viewer). The `tab` parameter is dead —
`reports/page.tsx` does not read it — so the navigation MUST NOT emit it. This
complements the existing rule that the reports history page carries no tab
state: neither the page nor the links that reach it depend on a `tab` param.

A stray `tab` parameter typed directly into the address bar still resolves to
the same History view (back-compat), and the History link still renders active
on `/reports` and on published-report paths regardless of any stray param.

#### Scenario: the History nav link omits the tab param

- **WHEN** the NavBar renders the History link for a lead, head, or viewer
- **THEN** the link's href is `/reports` with no `tab` query parameter

#### Scenario: History stays active on a stray tab URL

- **WHEN** `/reports?tab=drafts` or `/reports?tab=published` is open directly
- **THEN** the History nav link still renders as the active link
