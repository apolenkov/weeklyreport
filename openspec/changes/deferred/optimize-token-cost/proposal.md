# Optimize Claude Code token cost

## Problem

CustomReport sessions consume high token counts on routine operations (git,
npm, type checks, lint). RTK is partially configured but not leveraged for all
dev commands.

## Solution

Three-wave audit and enforcement:

1. Validate `.claudeignore` patterns (exclude node_modules, dist, lock files).
2. Extend `settings.json` deny rules for quiet-on-PASS (lint, typecheck
   success).
3. Document mandatory RTK prefixes for common workflows (git, npm, build,
   test).

## Non-goals

- Change build or test behavior.
- Alter the development experience.
