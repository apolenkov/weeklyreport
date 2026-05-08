# Phase 8: Tooling Upgrades - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Monorepo runs on current-generation toolchain; all existing tests and builds pass on upgraded dependencies. pnpm 9→10, Next.js 15→16 (middleware.ts→proxy.ts), Vitest 3→4, ESLint 10 flat config, CLAUDE.md updated.

Requirements: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key pitfalls from research:

- P2: Next.js 16 middleware.ts→proxy.ts rename (middleware silently ignored if not renamed)
- pnpm 10 blocks lifecycle scripts — needs onlyBuiltDependencies allowlist
- Vitest 4 pool option renames
- ESLint 10 is a fresh setup (no existing config to migrate)

</decisions>

<code_context>

## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
