# One Node Runtime Across Gates And Images

## Why

The repository ran three Node majors at once and nothing detected it.

- `.nvmrc` and CI: **26** — every typecheck, lint, unit and e2e run.
- `Dockerfile.web`: **node:25-alpine** — the shipped web runtime.
- `Dockerfile.api`: **24.17.0** — never declared anywhere. It arrived inside
  `mcr.microsoft.com/playwright:v1.61.1-noble` and no file in the repo names it.

So the gate has been proving the code correct on a major that runs in no
container, and the API executes on a major nothing tests. Node 25 reached
end of life on **2026-06-01** (nodejs/Release `schedule.json`), which means the
web image spent roughly eight weeks on a line receiving no security fixes.

`openspec/specs/dependency-currency` already forbids the shape of this bug:
_"the `@types/node` major MUST be at or below the Node major the project
actually runs"_. It was satisfied literally and violated in substance, because
it defined "actually runs" as `.nvmrc` and CI — developer conveniences — rather
than the images that execute the code. The requirement was measuring the wrong
thing, so it could not fire.

## What changes

**One major everywhere: Node 26.** Chosen over 24 deliberately. 24 is Active
LTS today and is what the Playwright base already carried, so it was the cheap
answer; 26 becomes LTS on 2026-10-28 and is supported to 2029-04-30, which puts
the next forced migration years out instead of months.

The cost of 26 is that `apps/api` can no longer inherit its runtime from the
Playwright image, and that turns out to be a repair rather than a sacrifice:

- **`Dockerfile.api` moves to `node:26-bookworm`** (glibc, as Chromium and the
  native modules require) and installs Chromium in the runner stage with the
  very `playwright` package the API imports at runtime — `playwright` is a
  production dependency of `apps/api`, not a dev one. The browser revision is
  therefore the dependency's own, and the two cannot drift.
- **`scripts/check-playwright-image-sync.mjs` is deleted, not rewritten.** It
  guarded a failure mode — a baked Chromium revision diverging from the resolved
  `playwright` version, silently breaking PDF export while every suite stayed
  green — that no longer has a way to occur.
- **`corepack` is dropped from the API image.** `node:26` no longer ships it, so
  `corepack prepare pnpm@… --activate` would fail at build. Both images now
  install pnpm the same way, which also closes the mechanism split the config
  audit found (one image honouring `packageManager`, the other unable to).
- **`scripts/check-runtime-node-sync.mjs` replaces the deleted guard** and checks
  what was never checked: that `.nvmrc`, `engines.node`, both Dockerfile base
  images, and every `@types/node` declaration agree on one major — and that the
  pnpm pin in both images matches `packageManager`, which nothing enforces now
  that corepack is gone.

## Impact

- `Dockerfile.api`, `Dockerfile.web`, `.nvmrc`, root `package.json`
- `scripts/check-playwright-image-sync.mjs` deleted;
  `scripts/check-runtime-node-sync.mjs` added and wired into `pnpm lint`
- `openspec/specs/dependency-currency` — the runtime-major requirement is
  restated so "the runtime" means the images, with `.nvmrc` and CI following
  them rather than defining them

The API image is rebuilt from a different base, so PDF export is the one
behaviour that must be proven rather than assumed: a real `chromium.launch()`
and a non-empty PDF from inside the built image.
