## ADDED Requirements

### Requirement: The mutation-consumer audit MUST report the size of the set it examined

`apps/web/uat-suite/mutation-audit.mjs` runs in `--check` mode as a blocking
gate. It MUST print the count of procedures it extracted alongside its verdict,
and it MUST exit non-zero when that count is zero. A gate whose parser silently
matches nothing reports success on an empty set, and every defect behind it
stays invisible for as long as the parser stays broken.

Procedure extraction MUST be performed over the TypeScript syntax tree, not by
counting braces or matching a router literal by regular expression. The router
surface is assembled from factory functions, and a text scan tuned to one
authoring shape stops matching the moment that shape changes — without
reporting anything.

The audit MUST NOT shell out to a tool it does not declare as a dependency. It
reads the web sources it needs itself.

#### Scenario: The extractor matches nothing

- **WHEN** `pnpm uat:audit --check` runs and procedure extraction yields zero
  procedures
- **THEN** the gate exits non-zero and names the empty extraction as the reason,
  rather than reporting that every mutation passed

#### Scenario: The router is re-authored into a different shape

- **WHEN** the tRPC router is split, merged, or otherwise re-authored so that no
  namespace is declared as an object literal
- **THEN** the audit still extracts every procedure, because it walks the syntax
  tree rather than matching source text

### Requirement: A mutation counts as read back only on evidence, never on resemblance

The audit MUST classify each mutation as VERIFIED, PARTIAL, UNRESOLVED or BLACK
HOLE. VERIFIED requires that EVERY call site's success path reaches a cache
invalidation naming a real query, or a full-page navigation. The presence of a
similarly-named sibling query is NOT evidence and MUST NOT be consulted.

The three non-verified verdicts MUST stay distinct, because they call for
different actions: PARTIAL means the success path was followed end to end and
runs no read-back — a definite gap. UNRESOLVED means the success path left what
static analysis can see — a place the audit declines to guess. BLACK HOLE means
no web caller exists at all.

A mutation with no consumer MUST fail the gate unless it carries a written
justification in `apps/web/uat-suite/mutation-audit.allowlist.json`. The
allowlist is for deliberate tombstones and retentions; it is not a place to
park work.

#### Scenario: One call site cannot be followed

- **WHEN** a mutation has several call sites and the audit cannot follow the
  success path of one of them
- **THEN** the verdict for that mutation is UNRESOLVED, not VERIFIED — a clean
  success path elsewhere says nothing about the one that was never read

#### Scenario: A new unconsumed mutation appears

- **WHEN** a write procedure is added to the API with no web caller and no
  allowlist entry
- **THEN** `pnpm uat:audit --check` exits non-zero and names the procedure

### Requirement: The audit MUST NOT write to the tree in gate mode

`--check` evaluates and sets an exit code only. It MUST NOT refresh the report
markdown or any other tracked file. A gate that rewrites tracked output dirties
every push it runs on and races parallel sessions; report refreshes stay an
explicit, deliberate run.

#### Scenario: The gate runs on a clean tree

- **WHEN** `pnpm uat:audit --check` runs with no local modifications
- **THEN** the working tree is unchanged afterwards, whatever the verdict
