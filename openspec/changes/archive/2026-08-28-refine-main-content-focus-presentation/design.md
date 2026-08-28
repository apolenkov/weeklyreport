## Context

See `proposal.md` for the owner-visible problem and
`specs/main-content-focus-presentation/spec.md` for the behavioral contract.
The root layout owns one `Skip to content` link targeting `#main-content`.
Fifteen app source files render that landmark, including loading/error branches,
and `apps/web/src/app/main-content-focus-contract.test.ts` already parses those
TSX sources to require `tabIndex={-1}` on every discovered target. Presentation
is not governed there: Chrome can therefore apply its user-agent outline to the
entire focused `<main>`.

All web styling already converges through `apps/web/src/styles/app.css`, which
imports Tailwind and the package theme before defining application base rules.
Shared package controls own token-based `focus-visible` treatments, while some
pre-existing route-local native controls still expose browser focus indicators.
This change must preserve every visible bounded interactive indicator without
claiming or standardizing its styling origin.

The change touches no request path, shared schema, Prisma write, API surface, or
runtime dependency. It preserves the period dual-state, role-coverage,
destructive-database, and deferred-feature invariants without modification.

## Goals / Non-Goals

**Goals:**

- Give every existing and future `#main-content` target one presentation owner.
- Keep focus transfer and assistive-technology semantics unchanged.
- Make the source contract fail if either target focusability or its shared CSS
  presentation is removed.
- Bind browser acceptance to keyboard-origin focus at 375, 768, and 1280 px.

**Non-Goals:**

- No per-route styling, navigation redesign, color/token change, or new focus
  animation.
- No suppression of focus treatment on keyboard-operable elements.
- No attempt to close the separate 768 px Admin navigation overflow or the
  Action Log mobile disclosure finding.
- No new committed browser harness or expansion of R188 infrastructure.

## Decisions

### 1. Own landmark presentation in the application base stylesheet

Add one exact `#main-content:focus` base rule in
`apps/web/src/styles/app.css` that sets `outline: none`. The selector is narrow:
it cannot match a button, link, field, tab, menu item, or arbitrary landmark.
Because every route already consumes the same ID contract, the rule covers all
rendered branches without editing fifteen route files.

Alternatives considered:

- Adding `focus:outline-none` to each `<main>` was rejected because it creates
  duplicated route-level policy and makes new branches easy to miss.
- A new React wrapper was rejected because the routes have materially different
  shells and loading/error ownership; wrapping them would be an architectural
  refactor for a CSS state.
- Replacing the blue rectangle with another full-boundary ring was rejected
  because the owner explicitly rejected that presentation. The existing scroll
  to the main target and visible route heading provide the context transition.
- A broad `*:focus`, `main:focus`, or `[tabindex]:focus` suppression is forbidden
  because it could erase valid focus feedback outside this one landmark.

### 2. Extend the existing contract with CSS-AST evidence

Keep the TypeScript-AST route inventory and add a PostCSS-AST assertion over
`apps/web/src/styles/app.css`. The test must recognize only the exact
`#main-content:focus` rule with an `outline: none` declaration; a broad selector
or unrelated `outline: none` declaration must not satisfy it. This retains the
existing route-source diagnostics while giving the shared presentation rule a
machine-enforced home.

String snapshots or grep-only assertions were rejected because whitespace,
formatting, and unrelated declarations can create false positives. PostCSS is
already a web development dependency, so no package is added.

### 3. Separate static proof from real keyboard proof

The focused Vitest contract proves source coverage only. Browser acceptance
must start from an exact recorded patch, use real Chrome, activate the visible
skip link by keyboard, and assert all of the following at 375, 768, and 1280 px:

1. `document.activeElement.id === "main-content"`;
2. computed `outline-style` for the active landmark is `none`;
3. the primary content context is in the viewport;
4. after advancing focus, the next keyboard-operable control has a visible
   indicator bounded to that control;
5. screenshots of the landmark-focused and interactive-focused states contain
   no full-surface blue rectangle.

Evidence belongs in `~/work/customreport-archive/`, with exact HEAD, tree,
tracked-plus-sorted-untracked patch digest, viewport, DOM assertions, image
hashes, and process teardown. It does not enter curated `docs/`.

## Risks / Trade-offs

- **[Risk] A non-interactive landmark no longer has a drawn focus boundary.**
  -> Preserve actual focus, hash/scroll movement, semantic `main`, and visible
  route context; prove them in Chrome instead of claiming accessibility from the
  absence of a rectangle.
- **[Risk] A future global selector could suppress interactive focus.**
  -> Require the exact ID-scoped selector through PostCSS AST and exercise the
  next interactive control in browser acceptance.
- **[Debt outside this change] Some route-local controls use the browser focus
  indicator instead of the design-system ring token.** -> Keep that visible
  feedback intact here; inventory and standardize it only in separate responsive
  or design-system work with its own browser evidence.
- **[Risk] The explicit route inventory can drift when a new route is added.**
  -> Keep route-source diagnostics in the existing test and require any new
  `main-content` owner to enter that inventory as part of the current gate.
- **[Trade-off] The CSS rule is application-wide rather than component-local.**
  -> This is intentional because `main-content` is a root-layout navigation
  contract shared across otherwise unrelated route shells.

## Migration Plan

1. Add the failing PostCSS contract tests before the CSS rule.
2. Add the single application-base rule and run the focused web test, web
   typecheck, changed-file lint/format checks, and OpenSpec strict validation.
3. Start a source-built minimal stand, capture the three keyboard viewport
   pairs on one exact digest, obtain independent visual review, and tear down
   every process.
4. No feature flag, data migration, DB operation, API coordination, or staged
   rollout is required. Rollback removes the exact base rule and its new
   presentation assertions while retaining the pre-existing focusability test;
   a rollback knowingly restores the owner-rejected browser outline.
