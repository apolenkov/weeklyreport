## MODIFIED Requirements

### Requirement: Foreign-content cache purges preserve current isolation

The lead data-loading hook MUST isolate cross-author full content by the trusted current user id and session role before display. It MUST remove obsolete, legacy and unattributed scopes on mount and identity change while preserving pending and warm reads belonging to the exact trusted current viewer. Without a trusted viewer, or outside hydrated Everyone, it MUST expose no full content and MUST purge the sensitive procedure prefix. Scope metadata MUST NOT become server request input or authorization.

#### Scenario: leaving Everyone purges cached foreign content

- **WHEN** the record-visibility toggle moves from Everyone to Mine
- **THEN** the cached cross-author full-content query is removed
- **AND** a later return to Everyone re-fetches instead of serving stale rows

#### Scenario: identity change purges cached foreign content

- **WHEN** the signed-in user id or session role changes
- **THEN** the cached cross-author full-content query is removed
  unconditionally

#### Scenario: Another viewer becomes current while Everyone remains selected

- **WHEN** auth.me changes identity while the same QueryClient/report is mounted
- **THEN** every committed current-viewer projection excludes previous-viewer content
- **AND** the current viewer's pending response can settle without an extra refetch

## ADDED Requirements

### Requirement: Role-away suspension preserves local edit recognition

The lead editor MUST suspend unsent autosave while a head/admin redirect is pending. Payload/baseline inequality and local-only rows MUST still identify unsaved content for server reseed independently of writer enablement. Exact own-save echoes MUST reconcile identities without dropping newer fields; genuine external changes MUST retain existing conflict/refetch/announcement/adoption behavior.

#### Scenario: A delayed read arrives during role-away

- **WHEN** unsaved Lead input exists and the session becomes head/admin before a delayed read settles
- **THEN** no newly issued draft save occurs during suspension
- **AND** same-payload refresh or exact own-save echo preserves newer local input

### Requirement: Missing section retains supporting recovery

When section NOT_FOUND coexists with failed active/history reads, the Lead editor MUST expose persistent scoped Retry for only those failed supporting reads. Successful supporting recovery MUST return to unavailable while the section remains missing. Normal no-active precedence and expected NOT_FOUND notifications remain unchanged.

#### Scenario: Required history fails while section is missing

- **WHEN** section is unavailable and history fails
- **THEN** Retry requests history only, coalesces pending retries and remains available on failure
- **AND** successful history recovery returns to the unavailable section state
