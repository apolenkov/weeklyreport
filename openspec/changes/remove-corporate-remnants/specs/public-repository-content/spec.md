## ADDED Requirements

### Requirement: Public repository content uses portable examples

The public source tree SHALL be free of employer and department identifiers,
internal endpoints and real colleague identities. Documentation, assets,
configuration examples and fixtures SHALL use generic wording, reserved example
addresses and synthetic identities where these values are needed. The project
owner's public identity MAY appear in attribution and repository references.

#### Scenario: A reader checks the public tree

- **WHEN** a reader inspects source, fixtures, documentation, assets and deployment examples
- **THEN** they find no employer names, internal hosts or real colleague names, logins or email addresses

#### Scenario: An example requires a deployment address or user

- **WHEN** a public example or fixture needs an address or identity
- **THEN** it uses a reserved example address or synthetic identity that fulfills the same role
