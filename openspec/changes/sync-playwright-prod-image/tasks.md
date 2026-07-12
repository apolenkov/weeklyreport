## 1. Align the base image tag

- [ ] 1.1 Confirm the resolved Playwright version: `grep -nE 'playwright(-core)?@1\.[0-9]+' pnpm-lock.yaml` reports `playwright@1.61.0` and `playwright-core@1.61.0`; `apps/api/package.json` declares `"playwright": "^1.61.0"`
- [ ] 1.2 In `Dockerfile.api`, change the base image on the `FROM ... AS base` line from `mcr.microsoft.com/playwright:v1.59.1-noble` to `mcr.microsoft.com/playwright:v1.61.0-noble`
- [ ] 1.3 In the same file, update the stale `v1.59.1-noble` reference inside the `# TODO: pin @sha256` comment so the `imagetools inspect` note names the new `v1.61.0-noble` tag

## 2. Add the drift guard

- [ ] 2.1 Add `scripts/check-playwright-image-sync.mjs`: parse the `mcr.microsoft.com/playwright:v<x.y.z>-noble` tag out of `Dockerfile.api` and the resolved `playwright` version out of `pnpm-lock.yaml`; exit 0 when they match, exit 1 with a message naming both values (image tag vs resolved dependency) when they do not
- [ ] 2.2 Add a `lint:playwright-image` script to root `package.json` that runs `node scripts/check-playwright-image-sync.mjs`
- [ ] 2.3 Append `&& pnpm lint:playwright-image` to the root `lint` script so the guard runs inside `pnpm lint` (and therefore inside the `.husky/pre-push` gate)

## 3. Verification

- [ ] 3.1 Run `node scripts/check-playwright-image-sync.mjs` and confirm it exits 0 with the image tag and resolved dependency now aligned
- [ ] 3.2 Temporarily edit the `Dockerfile.api` tag to a mismatching value, re-run the guard, and confirm it exits non-zero naming both versions; then restore the correct tag
- [ ] 3.3 Run `pnpm lint` and confirm the full chain (including `lint:playwright-image`) exits 0
- [ ] 3.4 Confirm `grep -n 'v1.59.1-noble' Dockerfile.api` returns no matches
