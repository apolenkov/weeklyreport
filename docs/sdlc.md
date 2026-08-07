# SDLC and first-production readiness

This document is the durable control map for CustomReport. It distinguishes
what the repository declares, what has been executed locally, what GitHub or a
deployment system has verified live, and what remains unavailable or
unverified. A checked-in file is never proof that an external control is active.

## Evidence classes

| Class      | Meaning                                                        | Example                                                    |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| Repository | A versioned file declares a control.                           | CI workflow, OpenSpec requirement, runbook.                |
| Local      | A command ran against an exact commit and retained its result. | Lint, tests, build, runtime-sweep archive.                 |
| External   | An authorized API or service confirms current state.           | Protected branch rule, deployment record, registry digest. |
| Unverified | The control is unknown, unavailable, or blocked by access.     | An administrative API returns `403`.                       |

Reports MUST keep these classes separate. In particular, an active workflow is
not the same thing as a required merge check, and a local backup is not an
independent recovery copy.

## Lifecycle control map

| Stage   | Present control                                                                                                                         | Acceptance evidence now                                                     | First-production prerequisite                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Plan    | OpenSpec changes and durable specifications define non-trivial behavior.                                                                | Strict validation and traceable tasks.                                      | Production ownership, risk acceptance, and release boundary are named.                                                                 |
| Build   | Node and pnpm are pinned; frozen lockfile and explicit build-script allowlists are used; runtime images and Actions are pinned.         | Reproducible install and production image build on an exact commit.         | Build once on a trusted hosted runner; retain immutable image digest.                                                                  |
| Verify  | Lint, format, typecheck, unit, integration, E2E, migration-reset, Docker build, scenario catalog, and exhaustive runtime tooling exist. | Exact commands, exit codes, source identity, failures, and artifacts.       | Stable required checks protect `main`; mandatory UAT and runtime evidence pass on the release candidate.                               |
| Secure  | Dependabot covers npm, Docker, and Actions; a scheduled production-dependency audit runs; workflow tokens are read-only by declaration. | Workflow policy gate and audit results.                                     | Verify secret scanning, push protection, Dependabot security updates, CodeQL, dependency review, alert ownership, and incident access. |
| Release | Tags exist, but there is no verified registry publication or GitHub release process.                                                    | No release claim is allowed yet.                                            | Publish one image digest, SBOM, signed provenance, migration list, and immutable release manifest.                                     |
| Deploy  | Production Compose topology and a runbook exist; no production target exists.                                                           | Local rehearsal only, explicitly labelled.                                  | Protected staging/UAT/production environments promote the same verified digest with approvals and concurrency.                         |
| Operate | Readiness, liveness, metrics, logs, traces, error collection, dashboards, and alert-rule material exist.                                | Source-bound runtime evidence and controlled local observability rehearsal. | Owned user SLIs/SLOs, loaded rules, real receiver, runbook links, retention, and a tested end-to-end alert.                            |
| Recover | Periodic local dumps, freshness checks, restore guard, transactional restore, and migration guidance exist.                             | Isolated local restore evidence.                                            | Encrypted off-site copy, access audit, retention, scheduled restore drill, and measured RPO/RTO.                                       |
| Learn   | Findings feed OpenSpec, tests, architecture decisions, catalogue ratchets, and curated reviews.                                         | Each accepted finding has an owner, disposition, and regression proof.      | Release and incident reviews update controls, SLOs, runbooks, and backlog without hiding residual risk.                                |

## Current GitHub boundary

As of 2026-08-08, CI is configured for pull requests, pushes to `main`, and
manual dispatch. The GitHub Branches API reported `main` as unprotected. The
current token or private-repository plan returned `403` for rulesets, branch
protection details, Actions permission settings, and several security settings.
Those settings are **unverified**, not assumed absent or enabled.

The pre-production MVP may continue with the explicit direct-push authorization
in `CLAUDE.md`, but it MUST NOT call current CI an enforced merge gate. The local
pre-push hook is defense in depth, not server-side enforcement.

## First-production stop condition

The first production point is blocked until every item below has external or
source-bound evidence:

- [ ] `main` is protected by a rule or ruleset with stable required CI and
      security checks, review/conversation rules, no force push or deletion,
      and recorded bypass actors.
- [ ] Secret scanning, push protection, Dependabot alerts/security updates,
      CodeQL, and pull-request dependency review are verified and their initial
      findings are triaged.
- [ ] A trusted build publishes one immutable image digest with an SPDX or
      CycloneDX SBOM and signed provenance; deployment verifies the digest and
      attestation.
- [ ] Preview, staging/UAT, and production environments have appropriate branch
      restrictions, reviewers, secret scope, concurrency, and deployment
      history. The artifact is promoted, never rebuilt between stages.
- [ ] Schema promotion uses compatible migrations, a verified pre-deploy dump,
      post-migration smoke evidence, and an explicit fix-forward or restore
      decision.
- [ ] Encrypted backups exist in an independent failure domain; an isolated
      restore drill proves schema, row, and checksum evidence and measures
      RPO/RTO.
- [ ] User-facing availability, latency, error, queue, and backup SLIs have
      owned SLOs; alert rules are loaded and a real receiver plus runbook path
      has been tested.
- [ ] The release record binds commit, image digest, SBOM digest, provenance,
      migrations, required checks, approvals, deployment evidence, and rollback
      decision, and cannot be silently replaced.

If any item is absent, unverified, or represented only by a placeholder, the
project remains pre-production. Do not add a decorative deployment workflow to
make this list appear complete.

## Related durable sources

- [Quality program](quality-program.md)
- [Exemplary code standard](exemplary-code-standard.md)
- [Operations runbook](operations.md)
- [Contributor workflow](../CONTRIBUTING.md)
- `openspec/specs/ci-merge-gate`
- `openspec/specs/dependency-vulnerability-scanning`
- `openspec/specs/deploy-config-integrity`
- `openspec/specs/prod-security-hardening`
