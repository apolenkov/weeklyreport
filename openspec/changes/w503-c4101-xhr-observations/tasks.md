# Tasks

## 1. Crawler request observations

- [x] 1.1 Add a regression to the existing native observation fixture; prove two sequential GET requests on one XHR produce exactly two network rows and zero in-flight requests, with RED before repair.
- [x] 1.2 Replace accumulating XHR listeners with one pair and identity-based request accounting; prove GREEN for native active replacement, throwing open, explicit abort and ordinary onload/OPENED handlers, including nested open/send.

## 2. Integration verification

- [x] 2.1 Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check; retain command exits and exact reviewed SHA outside Git.
