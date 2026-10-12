# Design

## Decisions

The removed `src/**/*.integration.test.ts` pattern is a subset of the retained `src/**/*.test.ts` pattern. Only coverage exclusions change; the unit runner's integration exclusion remains. The middleware change is a comment only: assertRole still gives UNAUTHORIZED for null sessions and FORBIDDEN for wrong roles, with the same seven canonical builders.

## Test Audit

These are behavior-preserving mechanical edits. No new tests, production seams or manufactured RED are justified. Existing shipped logic is inspected and retains its distinct native evidence requirements; it is not reimplemented or claimed newly fixed.

## Verification

Run strict ESLint on all three modified TS files, exact changed-file formatting, scoped diff/ownership checks and strict validation of this unique change. Root owns whole gates, normal hooks/main publication and one aggregate review.

## Limitations

C0620 remains NE pending Root reconciliation of boot failure delivery/deadline policy. Existing source repairs do not establish Redis/PostgreSQL, HTTP, queue shutdown or configured-cloud acceptance.
