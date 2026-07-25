# Tasks

## 1. Move every declaration to one major

- [x] `.nvmrc` → `26`
- [x] `package.json` `engines.node` → `>=26.0.0`
- [x] `Dockerfile.web` base → `node:26-alpine`, digest-pinned
- [x] `Dockerfile.api` base → `node:26-bookworm`, digest-pinned
- [x] `@types/node` left at `^26.1.1` — already the target major, now legitimately
      matching the runtime instead of running ahead of it

## 2. Rebuild the API image without the Playwright base

- [x] Install pnpm and turbo with `npm install -g`; `corepack prepare` cannot be
      used because `node:26` no longer ships corepack
- [x] Install Chromium in the runner stage via `pnpm exec playwright install
  --with-deps chromium`, using the production `playwright` dependency
- [x] Replace the Playwright image's `pwuser` with the `node` user the base
      provides (same uid 1000)
- [ ] Build the image and prove PDF export: `chromium.launch()` succeeds and
      `page.pdf()` returns a non-empty buffer from inside the built image

## 3. Guard what was never guarded

- [x] Delete `scripts/check-playwright-image-sync.mjs`
- [x] Add `scripts/check-runtime-node-sync.mjs`: one major across `.nvmrc`,
      `engines.node`, both Dockerfile bases, every `@types/node`; plus the pnpm
      pin against `packageManager`
- [x] Wire it into `pnpm lint` in the slot the deleted guard held
- [x] Confirm the guard fails loud on a planted mismatch, not only that it passes
      when everything agrees — verified against a copy of the repo with `.nvmrc`
      set to 24 and with a mismatched pnpm pin; both exit 1 naming every source

## 4. Close the spec gap

- [x] Restate the runtime-major requirement so the images define the runtime
- [x] Record the removed Playwright-image requirement with its reason
- [ ] `pnpm lint` and the full unit suite green on Node 26
- [ ] CI green on all jobs after push
