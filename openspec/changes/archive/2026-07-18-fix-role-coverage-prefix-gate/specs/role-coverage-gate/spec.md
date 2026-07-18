## ADDED Requirements

### Requirement: Middleware-chain matching MUST be exact, not prefix

The role-coverage gate SHALL classify a procedure's middleware chain as
allowed only when it matches one canonical chain in `ALLOWED_CHAINS` at
exact length with every slot equal by reference identity. A shorter
canonical chain that happens to be a prefix of a longer one (for example
`PUBLIC_CHAIN` being a prefix of every protected chain) SHALL NOT cause a
longer, differently-role-gated chain to be classified as allowed.

#### Scenario: Hand-rolled chain reusing the shared metrics+logging prefix is rejected

- WHEN a procedure is built as
  `t.procedure.use(metricsMiddleware).use(loggingMiddleware).use(<a role
middleware not equal by reference to any of the 8 canonical role
middlewares>)`
- THEN `findUncoveredProcedures` includes that procedure's path in the
  offending list

#### Scenario: A procedure built on a canonical base still passes

- WHEN a procedure's middleware chain equals one of the 8 canonical chains
  (`publicProcedure`, `protectedProcedure`, `headProcedure`,
  `adminProcedure`, `leadProcedure`, `viewerProcedure`, `anyRoleProcedure`,
  `leadershipProcedure`) at exact length with every
  middleware equal by reference
- THEN `findUncoveredProcedures` does not include that procedure's path in
  the offending list

#### Scenario: A shorter canonical chain does not falsely match a longer chain

- WHEN a procedure's middleware chain is strictly longer than
  `PUBLIC_CHAIN` and its first two entries equal `PUBLIC_CHAIN` by reference
  but no full-length canonical chain equals it
- THEN `isProcedureChainAllowed` returns `false` for that chain
