# Security policy

## Supported versions

WeeklyReport is pre-1.0. The maintainer applies security fixes to the
current `main` branch.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/apolenkov/weeklyreport/security/advisories/new).
Keep credentials, user records, private logs, and live-system reproduction
details out of public issues, pull requests, and commits.

Include the affected commit and component, expected impact, required access,
and the shortest reproduction against disposable or synthetic data. Redact
secrets and personal data from logs and attachments. Include a suggested
containment step if you have one.

The maintainer acknowledges reports in the advisory thread and uses it to
coordinate triage, follow-up, and disclosure. Fix timing depends on the impact
and the work required to verify the fix.

## Application and delivery boundaries

- Leave `AUTH_DEV_MODE` disabled in production. API startup rejects
  `AUTH_DEV_MODE=true` with `NODE_ENV=production`.
- Use `prisma/guards/_destructive-guard.ts` for destructive development and
  test operations. The guard requires a disposable database on loopback,
  a non-production environment, and explicit consent per run. Follow the
  [operations runbook](docs/operations.md) for production recovery.
- Keep credentials in untracked local environment files or managed deployment
  secrets. Commit placeholders in examples. If a credential leaks, revoke or
  rotate it at its provider, then verify that the old credential fails.
- The [CI workflow](.github/workflows/ci.yml) runs a blocking dependency audit
  and a redacted Gitleaks scan of the committed tree and reachable history.
  The scan traverses every parent and checks merge diffs against the first parent.
  The local pre-push gate runs the same checks. [CodeQL](.github/workflows/codeql.yml)
  scans JavaScript and TypeScript. [OpenSSF Scorecard](.github/workflows/scorecard.yml)
  publishes repository security checks.

## Incident response

Pause affected publishing or deployment, revoke affected credentials, and
preserve run IDs, commit and artifact digests, and audit events. Rebuild
affected artifacts from a reviewed commit and verify their identity before
promotion. Coordinate any public disclosure in the advisory thread.
