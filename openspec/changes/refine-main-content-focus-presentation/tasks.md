## 1. Web Regression Contract

- [x] 1.1 Extend `apps/web/src/app/main-content-focus-contract.test.ts` with a
      PostCSS-AST helper that accepts only an exact `#main-content:focus` rule whose
      `outline` declaration is `none`.
- [x] 1.2 Add positive and adversarial unit cases proving that an unrelated
      `outline: none`, a broad `main:focus`/`*:focus` selector, and a wrong outline
      value cannot satisfy the landmark presentation contract.
- [x] 1.3 Run
      `pnpm --filter @customreport/web exec vitest run src/app/main-content-focus-contract.test.ts`
      before the CSS implementation and preserve the expected RED result showing
      that the current application stylesheet lacks the exact rule.

## 2. Web Presentation Implementation

- [x] 2.1 Add the exact `#main-content:focus { outline: none; }` rule to the base
      layer in `apps/web/src/styles/app.css`, without editing route-local `<main>`
      classes or package-level interactive focus styles.
- [x] 2.2 Re-run
      `pnpm --filter @customreport/web exec vitest run src/app/main-content-focus-contract.test.ts`
      and require every existing TSX focusability case plus every CSS presentation
      case to pass.
- [x] 2.3 Inspect the resulting diff and confirm that no broad focus selector,
      new design token, dependency change, route wrapper, or unrelated responsive
      repair entered the implementation.

## 3. Planning and Static Verification

- [x] 3.1 Run
      `pnpm exec openspec validate refine-main-content-focus-presentation --strict`
      and require the proposal, new capability, design, and task graph to validate.
- [x] 3.2 Run `pnpm --filter @customreport/web typecheck`,
      `pnpm exec eslint apps/web/src/app/main-content-focus-contract.test.ts`,
      `pnpm exec stylelint apps/web/src/styles/app.css`, and
      `pnpm exec prettier --check apps/web/src/app/main-content-focus-contract.test.ts apps/web/src/styles/app.css openspec/changes/refine-main-content-focus-presentation`;
      record every command and exit code.
- [x] 3.3 Run `pnpm test`, `pnpm build`, and the full `pnpm lint`; do not promote
      a nonzero repository-wide lint caused by preserved R188 work into a green
      whole-repository claim, and reject any new diagnostic owned by this change.
- [x] 3.4 Run `git diff --check`, recompute the full tracked plus
      sorted-untracked patch digest, and freeze that identity before browser work.

## 4. Real-Chrome Keyboard and Visual Evidence

- [x] 4.1 Start the minimal source-built web/API stand for the exact frozen
      digest, using only the guarded disposable `customreport_e2e` target when a DB
      operation is necessary; record ports, source identity, fixture boundary, and
      startup health without using stale Docker application images.
- [x] 4.2 In real Chrome at 375 px, 768 px, and 1280 px, reach the Admin surface
      by keyboard, activate `Skip to content`, and assert
      `document.activeElement.id === "main-content"`, computed
      `outline-style === "none"`, and visible primary route context.
- [x] 4.3 At each viewport, advance to a keyboard-operable control and prove a
      visible focus indicator remains bounded to it; capture both landmark-focused
      and interactive-focused screenshots without a full-surface blue rectangle.
- [x] 4.4 Write the six screenshots, DOM/computed-style assertions, image
      hashes, viewport metadata, HEAD/tree/patch digest, and honest verdict to a new
      `~/work/customreport-archive/` packet; update the archive `INDEX.md` without
      deleting or rewriting the historical `8dfccedd` evidence.
- [x] 4.5 Close the browser and stop every web/API/test process started by this
      change, then prove the dedicated ports have no listeners and no test runner
      remains.
- [x] 4.6 Obtain two independent read-only visual/accessibility reviews of the
      exact evidence packet; both must confirm removal of the landmark rectangle,
      preservation of interactive focus feedback, source binding, and honest
      separation from the unrelated 768 px navigation and mobile disclosure
      findings.

## 5. Exact-State Closeout

- [x] 5.1 Recompute the full tracked plus sorted-untracked patch digest after
      evidence/index updates and prove the repository product paths did not drift
      during browser review.
- [x] 5.2 Mark tasks complete only from their recorded command, browser, and
      review evidence; rerun strict OpenSpec validation and keep the change open if
      any required proof is absent or any owner finding remains within this scope.
- [x] 5.3 Record the final scoped verdict as CODE-PROVEN, TEST-PROVEN, and
      LIVE-PROVEN only where the exact-digest evidence supports each label; do not
      infer CR-001, R188, release, remote, CI, or whole-product closure from this
      focused repair.
