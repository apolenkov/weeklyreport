# WeeklyReport product excellence through SDLC

Bring WeeklyReport to an exemplary, maintainable MVP standard. Product
architecture, readable production code, correctness and user value come first;
testing, observability, delivery, recovery and documentation exist to sustain
those properties rather than becoming parallel products.

## Repository authority

For this MVP, the owner authorizes any repository-local change needed to reach
the goal: refactor, replace or delete code, tests, tooling, configuration,
documentation and dependencies; create commits; and fast-forward verified work
to `main`. This standing authority does not cover credentials, production or
shared data, account-level settings, paid external actions, or bypassing an
exact destructive-data guard.

## Done condition

- Maintained product code has clear domain ownership, enforced dependency
  boundaries, readable names, focused modules, no dead paths and no hidden
  lint/style exemption.
- User-facing behavior is correct, accessible and coherent for every active
  owner-priority requirement.
- Tests are colocated with the product behavior they prove. Production code
  keeps the strict structural and immutability floor; tests use simpler rules
  focused on readability and failure value.
- Deployment configuration, observability, recovery and documentation describe
  and exercise the actual product without a standalone browser/UAT platform.
- Every active non-deferred OpenSpec change is reconciled, the worktree is
  clean, `main` and its remote tip match, and the applicable deterministic CI
  jobs pass on that exact SHA.

The six `fix-mobile-*` changes and their 15 unchecked tasks remain explicitly
owner-deferred. They are outside the current completion denominator until the
owner reactivates them.
