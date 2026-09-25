# Design

## Context

See `proposal.md` for motivation. Four pnpm patches currently modify Agentation, node-saml, samlify, and xml-crypto. Agentation's patch adds presentation behavior and a private synchronization detail; the SAML patches adapt packages to the incompatible `@xmldom/xmldom` 0.9 parser API. The solution must use published packages without weakening feedback identity or XML security.

## Goals / Non-Goals

**Goals:**

- Reach zero `patchedDependencies` and zero tracked third-party patch files.
- Keep authenticated Agentation storage/MCP boundaries and SAML validation operational.
- Make the stock-package contract executable in repository checks.

**Non-Goals:**

- Redesigning the feedback UI or SAML architecture.
- Changing database state, lifecycle writes, role middleware, or deployment topology.
- Cleaning unrelated overrides or concurrent work.

## Decisions

### Use stock Agentation behavior

Remove the Agentation patch and its bundle-format-dependent popup contract. Preserve tests of public widget callbacks, authenticated API behavior, MCP transport, storage, and deletion semantics. Alternative rejected: recreating the popup logic in an application wrapper would merely move the fork into first-party code.

### Resolve SAML compatibility through published versions

Upgrade published XML dependencies where compatible and constrain `@xmldom/xmldom` to the latest secure release line supported by node-saml and samlify. Verify malformed XML and SAML signature paths with existing auth tests. Alternative rejected: retaining parser API rewrites in patch files.

### Enforce zero patches at repository level

Extend the smallest existing repository-safety test to reject `patchedDependencies` and tracked package patch files. This prevents silent reintroduction without adding a new framework or abstraction.

### Preserve load-bearing invariants

The period dual-state, role-coverage gate, and destructive database guard are untouched. No request path, Prisma write, shared schema, migration, feature flag, or destructive operation changes.

## Risks / Trade-offs

- Stock Agentation popup placement may be less polished at viewport edges -> accept upstream behavior and retain public integration coverage.
- A compatible xmldom line may resolve differently after lockfile regeneration -> pin a bounded supported range and prove parser behavior with targeted tests plus frozen install.
- Concurrent lockfile edits cannot be merged mechanically -> produce a task-scoped commit in an isolated worktree and reconcile only after the other owner is known.

## Migration Plan

1. Update dependency versions/ranges and remove all patch declarations/files in the isolated worktree.
2. Regenerate the pnpm lockfile once.
3. Run targeted Agentation and SAML/XML checks, then all repository gates.
4. Commit only task-owned files. Integration into the busy checkout is a separate reconciliation step; rollback is the single task commit revert.
