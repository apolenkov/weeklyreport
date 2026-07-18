## ADDED Requirements

### Requirement: Rejected SAML assertions are always audited and metered

The SAML callback route MUST record every rejected assertion — bad
signature, expired, or replay — in the audit log via `loginFail` and in the
`loginAttemptsTotal{outcome="fail"}` Prometheus counter, before redirecting
the user to the error page. The recording path MUST be reachable regardless
of whether Passport rejects the assertion internally or the application code
rejects it after Passport hands back a profile.

#### Scenario: An invalid assertion is audited and metered

- **WHEN** the SAML IdP callback presents an assertion that Passport rejects
  (bad signature, expired, or replay)
- **THEN** an audit entry is written via `loginFail` with
  `reason: "invalid_assertion"`
- **AND** `loginAttemptsTotal{method:"saml", outcome:"fail"}` is incremented
- **AND** the user is redirected to `/auth/error?reason=invalid_assertion`

#### Scenario: A valid assertion is not recorded as a failure

- **WHEN** the SAML IdP callback presents a valid, accepted assertion
- **THEN** no `loginFail` audit entry is written
- **AND** `loginAttemptsTotal{outcome:"fail"}` is not incremented
