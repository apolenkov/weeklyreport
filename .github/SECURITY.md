# Security Policy

WeeklyReport is pre-production software in a private repository. Treat reports
about credentials, authentication, authorization, personal data, CI/CD, and
deployment infrastructure as confidential even when no production traffic
exists.

## Report a vulnerability privately

Use GitHub private vulnerability reporting or a private repository security
advisory when that feature is available. Otherwise contact the repository owner
through an already approved private work channel.

Do not put a suspected secret, exploit, user record, access token, private log,
or reproduction against a live system in a public issue, pull request, chat, or
commit. Include only the minimum evidence needed to reproduce the problem:

- affected commit, component, route, or workflow;
- impact and required access;
- deterministic reproduction against disposable or synthetic data;
- relevant request, trace, or run identifiers with secrets removed;
- suggested containment, when known.

The repository owner coordinates triage until a dedicated security team and
on-call rotation exist. A report is not closed until containment, root cause,
verification, and follow-up ownership are recorded.

## Leaked credential response

Deleting a credential from Git history does not invalidate it. For a suspected
leak, use this order:

1. Pause the affected publish, deployment, integration, or automation path.
2. Revoke or rotate the credential at its provider.
3. Preserve the relevant commit, workflow run, audit record, deployment record,
   and timestamps without copying the secret.
4. Determine the credential scope, observed use, affected systems, and exposure
   window.
5. Update dependent services and verify that the old credential no longer
   works.
6. Remove the secret from current source and, when necessary, perform a
   separately reviewed history rewrite.
7. Record root cause, detection gap, corrective control, and owner.

## CI/CD compromise response

For a suspected pipeline, dependency, runner, artifact, or deployment
compromise:

```text
detect -> pause publish/deploy
       -> revoke affected identities
       -> preserve run, commit, digest, provenance, and audit evidence
       -> inspect access and deployment history
       -> rebuild from a known-good reviewed commit
       -> verify dependencies and artifact identity
       -> promote through protected environments
       -> record root cause and prevention
```

Do not reuse an artifact whose source, builder identity, dependency graph, or
provenance is uncertain. Database recovery is a separate destructive decision;
follow [the operations runbook](../docs/operations.md) and do not represent an
image rollback as a schema rollback.

## Disclosure

Coordinate disclosure with the repository owner. Do not disclose an unresolved
vulnerability, active exploit path, or leaked credential outside the approved
response group. Preserve reporter attribution unless the reporter requests
anonymity.
