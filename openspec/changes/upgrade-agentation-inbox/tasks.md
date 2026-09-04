## 1. Contract and domain behavior

- [x] 1.1 Confirm the inbox view model exposes lifecycle, actor, timestamps,
      normalized context IDs, original content protected from reviewer edits,
      evidence, and thread data without widening server scope.
- [x] 1.2 Add or verify adapter/domain commands for author-only original edit,
      acknowledge, resolve, reply, and reasoned non-destructive dismiss.
- [x] 1.3 Add admin-only, confirmation-gated deletion for one visible item from
      either source; preserve Agentation sessions, cascade children, and reject
      bulk deletion.

## 2. Workbench UI

- [x] 2.1 Replace passive status presentation with labeled lifecycle badges and
      an accessible status/action area.
- [x] 2.2 Add inline detail/evidence disclosure and thread/reply affordances;
      do not provide `Open context` or `Open live page` navigation.
- [x] 2.3 Show Edit only for the authenticated author of an editable original;
      show triage actions only when the server-authorized capability allows it.
- [x] 2.4 Implement confirmed `Dismiss` with required reason plus admin-only
      confirmed single-item `Delete` for either source; no bulk controls;
      support desktop and narrow mobile layouts.

## 3. Verification

- [x] 3.1 Add focused web/API tests for permissions, lifecycle transitions,
      reply, author-only edit, required dismiss reason, admin-only Agentation
      delete, legacy-row handling, and rejection of bulk operations.
- [x] 3.2 Browser-verify admin and lead flows at supported desktop and narrow
      viewports: keyboard/focus, inline context, error recovery, no
      horizontal overflow, and zero console/network errors.
- [x] 3.3 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
      `pnpm build`, `pnpm spec:check`, and strict validation for this change.
