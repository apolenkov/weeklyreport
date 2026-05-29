# Design

## Context

The parent change `defer-uat-codequality-vercel-2026-05-26` defined Wave 5 as
"`pnpm typecheck && pnpm lint && pnpm test && pnpm lint:md` — all green; repeat
Playwright sweep: 0 console errors per role." Two things need pinning before
this can be a durable acceptance bar:

1. **What counts as the gate chain.** The parent's prose omits `pnpm build`.
   A green typecheck/lint/test does not guarantee a production build succeeds
   (Next.js build-time checks, server/client boundary errors, tree-shaking).
2. **What counts as a console "error."** A raw "0 console output" bar is
   unachievable in practice — browsers emit benign warnings and a favicon 404
   on routes without a favicon. A strict bar would either be gamed or perpetually
   red.

## Decision

**Gate chain is five commands, all exit 0:**
`pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm lint:md`.
`build` is included so the acceptance bar matches what ships.

**Console classification for the re-sweep:**

- **ERROR** (`console.error` / page errors / uncaught exceptions) -> the sweep
  FAILS. The bar is 0 ERRORS per role.
- **WARNING** (`console.warn`) -> logged for the record, does NOT fail the
  sweep. Warnings are tracked but not blocking, so the bar is enforceable
  without suppressing legitimate diagnostics.
- **favicon 404** -> ignored. A missing-favicon network 404 is environmental
  noise, not an application defect, and is explicitly exempt.

This change adds the requirements via `ADDED Requirements` deltas on the
`uat-quality-gates` capability (the parent's capability). It is the explicit
final-gates extension, so it shares the capability name rather than forking a
new one. It does not use `MODIFIED` — the parent's requirements stay as written;
this change only adds the authoritative five-command chain and the refined
console classification alongside them.

## Alternatives considered

- **New capability name (e.g. `final-acceptance-gate`).** Rejected: fragments
  the acceptance-gate concept across two capabilities for no benefit. The task
  brief explicitly carves out `uat-quality-gates` extension for this change.
- **`MODIFIED Requirements` rewriting the parent's two requirements.** Rejected:
  the parent is unarchived, so `uat-quality-gates` is not yet in
  `openspec/specs/`; a `MODIFIED` delta would fail `--strict` ("requirement not
  found"). `ADDED` is both semantically correct (extend, not edit) and valid.
- **Four-command chain (mirror the parent prose).** Rejected: omitting `build`
  lets a broken production build pass the final gate.
- **Strict 0-console-output bar.** Rejected: benign warnings and the favicon
  404 make it unachievable; the classified bar (0 ERRORS, warnings logged,
  favicon-404 ignored) is enforceable and meaningful.
