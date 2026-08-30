## Context

See `proposal.md` for motivation. Pnpm 11 verifies dependency state before `exec` and `run` by default. In the production Dockerfiles, the explicit frozen install uses a BuildKit-mounted store, then the pruned full source is copied into the image. Patch-file metadata makes the later dependency preflight consider the install stale, so `pnpm exec prisma generate` starts a second install outside the cache mount. Two exact-SHA production builds reproduced the same registry timeout.

The change does not touch period dual-state, role coverage, destructive-database guards, or deferred-feature behavior.

## Goals / Non-Goals

**Goals:**

- Keep the explicit frozen install as the only dependency-acquisition step in each production Docker build path.
- Preserve the exact Prisma, Turbo, and Playwright versions selected by the lockfile.
- Fail statically if a later Dockerfile edit restores a Pnpm wrapper around an installed tool.

**Non-Goals:**

- Disable Pnpm dependency verification for local development or CI.
- Change image topology, dependency versions, the lockfile, or application behavior.
- Make a genuinely failed explicit install appear successful.

## Decisions

### Invoke installed binaries directly after dependency installation

Every post-install Prisma, Turbo, and Playwright command uses its existing `node_modules/.bin` executable. The migration image uses the installed Prisma executable as its runtime command. This preserves the lockfile-selected implementation while bypassing Pnpm's dependency-preflight entrypoint.

Alternatives rejected:

- Increasing network timeouts only makes the hidden second install slower to fail.
- Reusing `/pnpm/store` on later commands reduces downloads but does not prevent the implicit install caused by modified patch metadata.
- Disabling `verifyDepsBeforeRun` repository-wide weakens unrelated developer and CI behavior for a Docker-only problem.
- Offline mode still permits the unwanted reconciliation and fails when its cache is incomplete.

### Keep Pnpm reconciliation disabled across Turbo's strict task boundary

Turbo starts workspace scripts through the package manager. Its strict environment mode filters undeclared variables, so a Docker `ENV` setting alone does not reach those child processes. Each production builder stage therefore sets `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` after inheriting the authoritative frozen install, and `turbo.json` declares that variable in `globalEnv`. The value is part of Turbo's cache key and reaches every build dependency without switching Turbo to loose environment mode. The installer stages remain unchanged so development containers keep Pnpm's normal verification behavior.

Alternatives rejected:

- Passing `--env-mode=loose` would expose every build-stage variable to tasks and weaken cache determinism.
- Adding the setting to the repository `.npmrc` would change local and CI Pnpm behavior outside the Docker-only failure mode.
- Direct Turbo invocation alone is insufficient because Turbo's child workspace scripts still enter through `pnpm run`.

### Extend the existing production configuration gate

The current TypeScript gate already owns Dockerfile install-cache and runtime assertions. It will require the builder-scoped preflight setting, prove it does not leak into the dev installer targets, require Turbo's strict allowlist entry and the direct local commands for API generation, both builds, Chromium installation, and both Compose migration paths, and reject the former late Pnpm forms. This keeps the mechanical policy in one existing gate rather than adding a new harness.

## Risks / Trade-offs

- **Risk:** An expected local binary is absent because the dependency graph changed. **Mitigation:** The Docker build fails immediately at the named command, and the static gate keeps the command aligned with the installed package.
- **Risk:** A future tool changes its binary location. **Mitigation:** Update the explicit install, Dockerfile command, and ownership test together in one reviewed change.
- **Trade-off:** Direct binaries and the Docker-scoped setting skip Pnpm's helpful stale-dependency check. This is intentional only after an explicit frozen install inside an immutable Docker build; local and CI Pnpm behavior is unchanged unless that same variable is explicitly supplied.

## Migration Plan

1. Land the Dockerfile and existing gate-test changes together.
2. Run the focused production configuration test, the full local gates, and a production Docker build with exact revision-label checks.
3. Roll back the single change if any image cannot find its lockfile-installed tool; no data or schema migration is involved.
