# Slice boundaries use curated index barrels

**Date:** 2026-07-14

**Status:** accepted and implemented.

API modules and web feature slices may cross sibling boundaries only through the
sibling's curated `index.ts` surface. ESLint zones enforce this rule, and
each export exists for a consuming sibling. Deep imports are rejected.

Barrels are intentionally small public facades, not convenience re-export
trees. Changes add only exports required by an active consumer. The boundary
rule is part of the current module architecture.
