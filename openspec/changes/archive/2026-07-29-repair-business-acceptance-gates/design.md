# Design

## Decision: assert transitions, not incidental seed cardinality

Tests that exercise a mutation will read the relevant precondition, perform one
business action, and assert the exact postcondition relative to that
precondition. Absolute counts remain appropriate only where the seed manifest
explicitly declares that count as part of its contract.

This keeps the `full` profile free to add unrelated products, users, and
sections without invalidating business-flow tests.

## Decision: preserve accessibility semantics

The submit confirmation is destructive enough to use `alertdialog`. Browser
tests will locate it by that role and the visible title `Confirm submission`.
They will not weaken the assertion to unscoped text or a generic selector.

## Decision: separate execution availability from test result

The acceptance record has three states:

1. not started,
2. rejected before runner/test execution,
3. executed with a pass/fail conclusion.

A GitHub billing/spending rejection is state 2. It is not evidence about the
repository and remains an explicit external blocker until a dispatched run
receives a runner.

## Verification matrix

| Surface                      | Evidence                                             |
| ---------------------------- | ---------------------------------------------------- |
| Report edit/autosave/submit  | integration Playwright journey                       |
| Publish/reopen/revoke/review | cross-role and head integration journeys             |
| Period lifecycle             | integration lifecycle journey plus DB postconditions |
| Dashboard KPI and role scope | browser-visible KPI plus scoped DB truth             |
| Admin settings               | browser mutation, reload, and DB truth               |
| Slides                       | targeted browser journey and role sweep              |
| Runtime security headers     | production-build CSP suite                           |
| Full role surface            | UAT catalog sweep                                    |
| Server-side gate             | fresh GitHub Actions dispatch that receives a runner |
