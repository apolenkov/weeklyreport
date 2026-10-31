# Tasks

## 1. Specification

- [x] 1.1 Validate with `pnpm exec openspec validate w503-r3-head-slide-selection-identity --strict`.

## 2. Web

- [ ] 2.1 RED: head deck test inserting a slide before the selected one keeps the selected owner.
- [ ] 2.2 GREEN: store the selected slide key in `HeadSlidesClient`; export `slideArticleKey`.

## 3. Verification

- [ ] 3.1 Focused vitest (head deck, carousel), prettier, eslint and web typecheck.
