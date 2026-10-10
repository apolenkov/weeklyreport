# SDLC and first-production readiness

This document is the durable control map for WeeklyReport. It distinguishes
what the repository declares, what has been executed locally, what the hosting platform or a
deployment system has verified live, and what remains unavailable or
unverified. A checked-in file is never proof that an external control is active.

## Evidence classes

| Class      | Meaning                                                        | Example                                                    |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| Repository | A versioned file declares a control.                           | CI workflow, OpenSpec requirement, runbook.                |
| Local      | A command ran against an exact commit and retained its result. | Lint, colocated tests, and build.                          |
| External   | An authorized API or service confirms current state.           | Protected branch rule, deployment record, registry digest. |
| Unverified | The control is unknown, unavailable, or blocked by access.     | An administrative API returns `403`.                       |

Reports MUST keep these classes separate. In particular, an active workflow is
not the same thing as a required merge check, and a local backup is not an
independent recovery copy.

WeeklyReport keeps verification adjacent to the product: unit tests live beside
their modules, and API database integration tests live under `apps/api/src`.
Browser and acceptance checks are performed against the running application;
they are not a separate product surface. The guarded disposable database is
used only for local and CI verification.

Browser acceptance drives a real browser session against the running app: each
check names its expected observable consequence before acting and confirms it
with DOM, network, or screenshot evidence. Deterministic tests and gates remain
the acceptance authority; no custom replacement gate substitutes for them.

## Lifecycle control map

| Stage   | Present control                                                                                                                                                            | Acceptance evidence now                                                     | First-production prerequisite                                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan    | OpenSpec changes and durable specifications define non-trivial behavior.                                                                                                   | Strict validation and traceable tasks.                                      | Production ownership, risk acceptance, and release boundary are named.                                                                         |
| Build   | Node and pnpm are pinned; frozen lockfile and explicit build-script allowlists are used; runtime and CI images are pinned.                                                 | Reproducible install and production image build on an exact commit.         | Build once on a trusted hosted runner; retain immutable image digest.                                                                          |
| Verify  | Lint, format, typecheck, colocated unit/integration tests, migration reset, and Docker build exist.                                                                        | Exact commands, exit codes, source identity, failures, and artifacts.       | Stable required checks protect `main`; mandatory product suites pass on the release candidate.                                                 |
| Secure  | GitLab CI audits production dependencies (blocking) and development dependencies (non-blocking warning); a conditional Renovate job is declared, activation is unverified. | Pipeline source inspection and audit results.                               | Verify secret scanning, push protection, dependency-update automation, code scanning, dependency review, alert ownership, and incident access. |
| Release | Tags exist, but there is no verified registry publication or release process.                                                                                              | No release claim is allowed yet.                                            | Publish one image digest, SBOM, signed provenance, migration list, and immutable release manifest.                                             |
| Deploy  | The production Helm chart and runbook exist; no production target is verified.                                                                                             | Local rehearsal only, explicitly labelled.                                  | Protected pre-production and production environments promote the same verified digest with approvals and concurrency.                          |
| Operate | Readiness, liveness, metrics, logs, traces, error collection, dashboards, and alert-rule material exist.                                                                   | Source-bound runtime evidence and controlled local observability rehearsal. | Owned user SLIs/SLOs, loaded rules, real receiver, runbook links, retention, and a tested end-to-end alert.                                    |
| Recover | Scheduled backup Jobs, restore guards, transactional restore, and migration guidance exist.                                                                                | Isolated local restore evidence.                                            | Encrypted off-site copy, access audit, retention, scheduled restore drill, and measured RPO/RTO.                                               |
| Learn   | Findings feed OpenSpec, tests, architecture decisions, and current runbooks.                                                                                               | Each accepted finding has an owner, disposition, and regression proof.      | Release and incident reviews update controls, SLOs, and runbooks without hiding residual risk.                                                 |

## Current hosting and CI boundary

The only configured remote is the private GitLab project ([ADR 0019](adr/0019-gitlab-is-the-only-remote-and-ci-runs-lint-and-test-only.md)).
`.gitlab-ci.yml` runs the lint/test lanes described in `docs/gitlab-ci.md`;
the production build, Docker build, PDF export, and browser acceptance are not
CI lanes. Repository files
do not prove that `main` is protected or that any platform security setting is
enabled. Those external settings are **unverified** until an authorized
read-back confirms them.

Any direct push requires explicit authorization for the task. The pre-production
MVP MUST NOT call current CI an enforced merge gate. No local commit or push
hooks are configured; run the local gates manually.

## First-production stop condition

The first production point is blocked until every item below has external or
source-bound evidence:

- [ ] `main` is protected by a rule or ruleset with stable required CI and
      security checks, review/conversation rules, no force push or deletion,
      and recorded bypass actors.
- [ ] Secret scanning, push protection, dependency-update automation,
      code scanning, and merge-request dependency review are verified and their initial
      findings are triaged.
- [ ] A trusted build publishes one immutable image digest with an SPDX or
      CycloneDX SBOM and signed provenance; deployment verifies the digest and
      attestation.
- [ ] Pre-production and production environments have appropriate branch
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

- [Exemplary code standard](exemplary-code-standard.md)
- [Operations runbook](operations.md)
- [Contributor workflow](../CONTRIBUTING.md)
- `openspec/specs/ci-merge-gate`
- `openspec/specs/dependency-vulnerability-scanning`
- `openspec/specs/deploy-config-integrity`
- `openspec/specs/prod-security-hardening`

The declared `renovate` job runs only with `RENOVATE_TOKEN` on scheduled, web or
API-triggered pipelines. Token provisioning and actual execution are not verified
by source inspection. See `.gitlab-ci.yml`, `renovate.json` and
[the artifact guide](./artifacts.md); configuring corporate tokens is separate
from local repository organization.
