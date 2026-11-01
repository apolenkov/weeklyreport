# Tasks

- [x] 1. RED: failing tests A (stale fullscreen state on disable) and B (stale
      exit focus after re-enable) in `use-fullscreen.test.ts`, plus
      characterization test C (error-callback identity change must not reset
      state).
- [x] 2. GREEN: reset `isFullscreen` and `wasFullscreenRef` in a
      `[enabled]`-scoped `useEffect` cleanup in `use-fullscreen.ts`.
- [x] 3. Validate the change:
      `openspec validate fix-fullscreen-state-reset-on-disable --strict`.
- [x] 4. Focused checks: focused vitest (use-fullscreen + head-report-shell),
      prettier, eslint, typecheck, `git diff --check`. The full six repo gates
      run on the final SHA by the coordinator before push.
