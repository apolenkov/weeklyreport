## Why

Wave 0 / P0 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

`Dockerfile.api` pins its base image to
`mcr.microsoft.com/playwright:v1.59.1-noble` and sets
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, so the production API image ships only the
Chromium revision baked into the 1.59.1 image. The `@customreport/api` workspace
resolves `playwright@1.61.0` (`apps/api/package.json` declares `^1.61.0`;
`pnpm-lock.yaml` resolves `playwright@1.61.0` and `playwright-core@1.61.0`). The
Chromium revision is version-coupled: 1.61.0 looks up a browser revision
directory the 1.59.1 image does not contain, and in-image download is disabled.

The PDF-export processor (`apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`)
imports `{ chromium }` from `playwright` and calls `chromium.launch({ headless:
true })`. In the built production image that launch throws "Executable doesn't
exist", so every PDF-export job fails at browser launch. Unit and E2E suites run
their own `playwright install` and therefore stay green, hiding the break — no
gate catches it.

This is an image/workspace desync, not a dependency-upgrade initiative: the fix
is to bring the two version pins back into lockstep and add a guard so they
cannot drift silently again. It is recorded against the `dependency-currency`
capability, which is the durable home for version-pin coupling decisions.

## What Changes

- Bump the `Dockerfile.api` base image tag from
  `mcr.microsoft.com/playwright:v1.59.1-noble` to
  `mcr.microsoft.com/playwright:v1.61.0-noble`, matching the resolved
  `playwright@1.61.0` so the baked Chromium revision is the one the workspace
  Playwright expects. Update the stale `v1.59.1-noble` reference inside the
  `# TODO: pin @sha256` comment in the same file so the digest-resolution note
  points at the correct tag.
- Add a drift guard `scripts/check-playwright-image-sync.mjs` that reads the
  `mcr.microsoft.com/playwright:v<x.y.z>-noble` tag from `Dockerfile.api` and
  the resolved `playwright` version from `pnpm-lock.yaml`, and exits non-zero
  when the two do not match — naming both values so the failure is
  self-explanatory. Wire it as a `lint:playwright-image` npm script and append
  it to the root `lint` chain in `package.json`, next to the existing
  `lint:prisma:typecheck` / `lint:status-literal-unions` gates, so it runs in
  `pnpm lint` and therefore in the `.husky/pre-push` gate.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `dependency-currency`: adds a requirement that the Playwright base-image tag
  in `Dockerfile.api` stays in lockstep with the resolved `playwright`
  dependency, and a requirement that a repository gate fails when the two drift.

## Impact

- `Dockerfile.api` (base image tag + stale-tag comment)
- `scripts/check-playwright-image-sync.mjs` (new guard)
- `package.json` (new `lint:playwright-image` script; appended to `lint`)

Non-goals: no change to `playwright`'s declared range or any other dependency;
no change to the PDF-export processor, compose files, or the image's multi-stage
structure; the `@sha256` digest pin remains deferred (only the tag inside its
note is corrected).
