## 1. GitHub Actions Trust Boundary

- [x] 1.1 Add an explicit `contents: read` permission baseline to every
      checked-in workflow.
- [x] 1.2 Disable checkout credential persistence in every current read-only
      workflow job.
- [x] 1.3 Extend the configuration-hygiene gate with positive and negative
      tests for permissions and checkout credential retention.
- [x] 1.4 Prevent Knip from loading the environment-dependent Prisma config and
      fail on configuration hints; pin both controls in the
      configuration-hygiene gate.

## 2. Ownership And Security Response

- [x] 2.1 Add `.github/CODEOWNERS` for the ownership policy, workflows, Prisma
      schema and migrations, deploy configuration, security policy, and shared
      contracts.
- [x] 2.2 Add `.github/SECURITY.md` with private reporting, leaked-secret response,
      CI/CD incident response, evidence preservation, and disclosure rules.

## 3. Durable SDLC Contract

- [x] 3.1 Add `docs/sdlc.md` with plan-to-learn lifecycle evidence, current MVP
      controls, and fail-closed first-production prerequisites.
- [x] 3.2 Link the SDLC contract from `docs/README.md` and align the durable
      `ci-merge-gate` and `dependency-vulnerability-scanning` specs with the
      active CI/unprotected-main state.

## 4. Verification And Evidence

- [x] 4.1 Run the targeted configuration-hygiene tests and parse every workflow
      through the new policy checker.
- [x] 4.2 Run `openspec validate harden-preproduction-sdlc-controls --strict`,
      `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the
      repository build with its required explicit API URLs.
- [ ] 4.3 Freeze a new source SHA and repeat source-bound preflight, visual,
      observability, and exhaustive runtime evidence before final acceptance.
