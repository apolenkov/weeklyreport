## 1. Evidence Foundation

- [x] 1.1 Freeze the 709 accepted starting finding identities and severity totals
      from `consolidation.json`, rejecting missing, duplicate, or silently renumbered IDs.
- [x] 1.2 Extend the ledger schema with final content digest, file classification,
      reviewer/check identities, verdict, finding links, disposition, and evidence fields.
- [x] 1.3 Rebuild inventory from all tracked plus non-ignored untracked worktree paths
      and emit exactly one explicitly classified ledger row per path.
- [x] 1.4 Make the ledger validator fail on missing or duplicate paths, digest drift,
      invalid terminal evidence, unresolved findings, and implicit exclusions.
- [x] 1.5 Expand the ten generic finding families into concrete path-bound children
      without double counting their parent observations.
- [x] 1.6 Add tests proving an edit reopens a terminal row and mechanical-only evidence
      cannot create an exemplary verdict.
- [x] 1.7 Bind the completed P0 repairs and their focused verification to current final
      blobs, re-opening any P0 whose source or evidence digest has since changed.
- [x] 1.8 Make consolidation, roadmap, Markdown, handoff, and HTML generation consume
      only a validated ledger digest.

## 2. Shared and UI Packages

- [x] 2.1 Adjudicate and remediate every P1 finding whose owning source is under
      `packages/shared`, with focused tests and public-contract compatibility evidence.
- [x] 2.2 Adjudicate and remediate every P1 finding whose owning source is under
      `packages/ui`, preserving semantic tokens and accessible component contracts.
- [x] 2.3 Resolve `TYPE-PORT-001` through `TYPE-PORT-008` using readonly function-
      property ports and direct detached-call tests where the production seam permits it.
- [x] 2.4 Resolve `TYPE-PORT-009` through `TYPE-PORT-015` without weakening adapter
      types, erasing dependency requirements, or introducing mutable return contracts.
- [x] 2.5 Review every public export in `packages/shared` and `packages/ui`; add concise
      contract JSDoc only where required and remove redundant tags or implementation prose.
- [x] 2.6 Remove mutable public collections and objects from package contracts, adding
      compile-time and runtime regression coverage for downstream consumers.
- [x] 2.7 Replace raw color and layout literals in package components with existing
      semantic tokens, adding tokens only when no truthful semantic owner exists.
- [x] 2.8 Re-review every changed package file at its final digest and require zero
      unresolved package findings before continuing to application roots.

## 3. API Application

- [x] 3.1 Resolve the API P1 auth, authorization, session, SAML, rate-limit, CSP, and
      security findings with negative-path regression tests and preserved role coverage.
- [x] 3.2 Resolve the API P1 environment, fallback, bootstrap, compose, and seed findings
      so mandatory product configuration fails loudly at its canonical boundary.
- [x] 3.3 Resolve the API P1 logging, audit, PII, error-classification, cache, and
      observability findings without swallowing degraded or persistence outcomes.
- [x] 3.4 Resolve the API P1 period, report-section, carry-over, and publication findings
      while preserving atomic period dual-state and existing durable semantics.
- [x] 3.5 Resolve the API P1 reminder, scheduler, queue, DLQ, ingestion, and retry
      findings with typed result contracts and exhaustion/failure-path tests.
- [x] 3.6 Resolve the API P1 PDF enqueue, worker, composition, secret, download, and
      artifact findings with durability and filesystem-boundary tests.
- [x] 3.7 Resolve the remaining API P1 query, identity, pagination, performance, and
      data-validation findings in path-sorted slices of at most 20 findings.
- [x] 3.8 Resolve API-owned P2 type-model, adapter, scope, exhaustiveness, and port
      findings in path-sorted slices of at most 20 findings.
- [x] 3.9 Resolve API-owned P2 test-seam, coverage, structural, determinism, fidelity,
      and brittleness findings without replacing production composition with source scans.
- [x] 3.10 Remove API-internal JSDoc and comment archaeology, relocating every
      load-bearing rationale before compression and security-reviewing sensitive paths.
- [x] 3.11 Refactor API files and functions outside the 300/70/10 limits into cohesive
      domain units without changing request, Prisma-write, or shared-schema behavior.
- [x] 3.12 Replace avoidable API `let`, reassignment, and in-place mutation with named
      pure transformations while retaining externally imposed mutation boundaries.
- [x] 3.13 Re-review every changed API file at its final digest and require zero
      unresolved API findings before continuing to the web root.

## 4. Web Application

- [x] 4.1 Resolve the web P1 model, identity, ownership, grouping, validity, and
      untrusted-data findings without manufacturing valid-looking fallback values.
- [x] 4.2 Resolve the web P1 query, reload, error, recovery, and authorship findings so
      failures remain observable and user feedback matches completed behavior.
- [x] 4.3 Resolve the web P1 dialog, focus, reentrancy, pending-dismissal, navigation,
      and accessibility findings with interaction-level tests.
- [x] 4.4 Resolve the web P1 dashboard, history, activity, slide, print, PDF, and
      portfolio findings while preserving canonical shared contracts.
- [x] 4.5 Resolve web-owned P2 type-model, data-validation, context, skeleton, recovery,
      DOM-coupling, and feedback findings in path-sorted slices of at most 20 findings.
- [x] 4.6 Resolve `STYLE-TOKEN-001` through `STYLE-TOKEN-023`, replacing fixed visual
      values with truthful semantic tokens and checking light and dark themes.
- [x] 4.7 Resolve `STYLE-TOKEN-024` through `STYLE-TOKEN-046`, rejecting token aliases
      that merely rename the same non-semantic literal.
- [x] 4.8 Resolve web-owned test redundancy, brittleness, weak coverage, structural
      source scans, and test-only production exports with behavior-level coverage.
- [x] 4.9 Remove all app-internal JSDoc in `apps/web`, including the 239-block starting
      corpus, after individually classifying delete, compress, or relocate by content.
- [x] 4.10 Remove stale and false web comments and operator narration, retaining only
      current non-obvious WHY or a short pointer to durable rationale.
- [x] 4.11 Refactor web files and functions outside the 300/70/10 limits into named,
      junior-readable feature units without spreading domain decisions across layers.
- [x] 4.12 Replace avoidable web `let`, reassignment, and in-place mutation with
      immutable transformations while preserving React lifecycle semantics.
- [x] 4.13 Re-review every changed web file at its final digest and require zero
      unresolved web findings before continuing to repository support surfaces.

## 5. Tests, E2E, Prisma, Scripts, and Configuration

- [x] 5.1 Finish every non-P0 E2E finding: response-listener ordering, owned context
      cleanup, dual-state fixtures, fail-closed role verification, and real resubmission.
- [x] 5.2 Split over-budget E2E journeys around reusable behavior, remove avoidable
      mutable accumulators, and keep lifecycle cleanup explicit in `finally` owners.
- [x] 5.3 Remove stale E2E network masks, archaeology, and internal helper essays; add
      positive and negative probes for every retained operational suppression.
- [x] 5.4 Resolve `TEST-TYPE-001` through `TEST-TYPE-015` without `never`, unchecked
      casts, or dependency erasure in production-facing test doubles.
- [x] 5.5 Resolve `TEST-TYPE-016` through `TEST-TYPE-029` with typed builders that
      preserve framework, adapter, and domain contract requirements.
- [x] 5.6 Resolve `TEST-REDUNDANCY-001` through `TEST-REDUNDANCY-010`, deleting or
      combining only tests whose asserted production behavior is directly duplicated.
- [x] 5.7 Resolve `TEST-REDUNDANCY-011` through `TEST-REDUNDANCY-019`, retaining any
      case that uniquely covers a branch, composition seam, or regression.
- [x] 5.8 Resolve `TEST-BRITTLENESS-001` through `TEST-BRITTLENESS-009` by asserting
      user-observable or contract behavior rather than utility classes and private markup.
- [x] 5.9 Resolve `TEST-BRITTLENESS-010` through `TEST-BRITTLENESS-018` and prove that
      surviving tests still fail on the defect each removed assertion represented.
- [x] 5.10 Remove the stale TODO and every stale or noncanonical marker; preserve loud
      deferred-feature traces with canonical `TODO(<ref>)` ownership.
- [x] 5.11 Restore the strongest local type for `failedReason` and remove normalization
      that makes adapter or persistence drift look valid.
- [x] 5.12 Remove duplicate snapshot tests only after mapping each deleted assertion to
      surviving direct behavioral coverage.
- [x] 5.13 Resolve Prisma, seed, reset, migration, schema-comment, random identity, and
      time-dependency findings without weakening the destructive production guard.
- [x] 5.14 Resolve active operational scripts and configuration findings, including
      result handling, SQL identifiers, Redis scope, environment boundaries, and output.
- [x] 5.15 Re-review every changed E2E, Prisma, script, test, and configuration file at
      its final digest and require zero unresolved findings in these surfaces.

## 6. Generic Finding Families

- [x] 6.1 Resolve `COMMENT-JSDOC-001` through `COMMENT-JSDOC-020` with per-file final
      evidence and public/internal surface classification.
- [x] 6.2 Resolve `COMMENT-JSDOC-021` through `COMMENT-JSDOC-040` with per-file final
      evidence and rationale relocation where required.
- [x] 6.3 Resolve `COMMENT-JSDOC-041` through `COMMENT-JSDOC-058` and prove that no
      applicable app-internal JSDoc remains in the final inventory.
- [x] 6.4 Resolve `COMMENT-ARCH-002` through `COMMENT-ARCH-025`, dereferencing every
      provenance marker before deletion or retention.
- [x] 6.5 Resolve `COMMENT-ARCH-026` through `COMMENT-ARCH-049` and prove that every
      retained reference resolves to a current durable owner.
- [x] 6.6 Resolve `COMMENT-BUDGET-001` through `COMMENT-BUDGET-017`, relocating
      load-bearing rationale before enforcing the three-line WHY budget.
- [x] 6.7 Resolve `COMMENT-BUDGET-018` through `COMMENT-BUDGET-033` and security-review
      every affected authentication or authorization surface.
- [x] 6.8 Resolve `STYLE-IMMUTABILITY-001` through `STYLE-IMMUTABILITY-016` with deeply
      readonly contracts and immutable implementation evidence.
- [x] 6.9 Resolve `STYLE-IMMUTABILITY-017` through `STYLE-IMMUTABILITY-032` without
      replacing mutation with unsafe casts or hidden mutable helpers.
- [x] 6.10 Resolve `STYLE-IMMUTABILITY-033` through `STYLE-IMMUTABILITY-047` and prove
      that downstream consumers cannot mutate exported state.
- [x] 6.11 Resolve `STYLE-MUTATION-001` through `STYLE-MUTATION-013` with named pure
      transformations and focused behavior tests.
- [x] 6.12 Resolve `STYLE-MUTATION-014` through `STYLE-MUTATION-026`, documenting only
      externally imposed mutation boundaries that remain.
- [x] 6.13 Adjudicate every remaining P2 and P3 specific defect not covered above in
      generated path-sorted batches of at most 20, requiring zero undisposed IDs.

## 7. Toolchain Ownership and Strictness

- [x] 7.1 Split the shallow `eslint.config.ts` hub into cohesive typed policy modules
      while preserving one flat-config export and all effective-config scope probes.
- [x] 7.2 Narrow `.prettierignore`, format every maintained supported file, and add a
      worktree-derived scope probe that catches newly added paths outside known roots.
- [x] 7.3 Make Stylelint warnings fail with `--max-warnings 0` and preserve a planted
      CSS warning probe through the canonical command.
- [x] 7.4 Wire package-specific type-coverage thresholds into the canonical aggregate
      gate after measuring runtime and add planted type-escape failures.
- [x] 7.5 Make the aggregate lint runner execute all owners, print every result, and
      exit nonzero on any error or warning without default fail-fast behavior.
- [x] 7.6 Enforce product files at most 300 counted lines, functions at most 70 lines,
      cognitive complexity below 10, and zero avoidable mutation at error severity.
- [x] 7.7 Add positive and nearby negative planted probes for structural limits,
      immutability, formatter scope, marker scope, type-coverage, and warning handling.
- [x] 7.8 Remove lint rules that duplicate Prettier ownership and document one primary
      owner and exact command for every remaining quality concern.
- [x] 7.9 Replace brand-name conformance prose with a generated or verified matrix of
      actual installed rules, versions, severities, scopes, exclusions, and probes.
- [x] 7.10 Verify that every supported product path receives the same hard floor via
      effective ESLint config and that adding a new app route cannot bypass it.

## 8. Suppressions and Universal Floor

- [x] 8.1 Re-enumerate every live inline directive, measurement-noise observation,
      `files` override, ignore, and rule weakening from final effective configuration.
- [x] 8.2 Give every inline directive a stable identity and `remove`, `replace`, or
      `retain` disposition with current source evidence.
- [x] 8.3 Give every configuration exemption an exact matched-path inventory, rationale,
      ownership boundary, and planted proof; reject overbroad matches.
- [x] 8.4 Remove every product-code suppression without moving the same debt into an
      unsafe cast, helper, file classification, ignore, or another tool.
- [x] 8.5 Drain every product grandfather and permanent override by refactoring its
      files to the universal 300/70/10 and immutable floor.
- [x] 8.6 Prove every retained non-product suppression is line-minimal and that an
      adjacent unguarded violation still fails production effective configuration.
- [x] 8.7 Regenerate the exemplary catalogue and require `filesOnFloor` to equal
      `productTotal`, with zero product classes `B`, `C`, `E`, or `F`.

## 9. Final Per-File Review

- [x] 9.1 Rebuild the final worktree inventory after all remediation and invalidate
      every ledger row whose digest no longer matches.
- [x] 9.2 Review every final `packages/shared` and `packages/ui` blob for semantics,
      structure, naming, tests, comments, contracts, and exemplary-floor compliance.
- [x] 9.3 Review every final `apps/api` blob in deterministic path-sorted batches of at
      most 25 files and record reviewer/check/verdict evidence for each file.
- [x] 9.4 Review every final `apps/web` blob in deterministic path-sorted batches of at
      most 25 files and record reviewer/check/verdict evidence for each file.
- [x] 9.5 Review every final Prisma, E2E, script, configuration, schema, workflow, and
      operational blob with checks appropriate to its maintained role.
- [x] 9.6 Review every curated documentation and OpenSpec blob for factual agreement
      with final executable behavior and current durable ownership.
- [x] 9.7 Apply objective integrity checks to every generated, vendored, binary, lock,
      or historical path and retain its explicit classification in the inventory.
- [x] 9.8 Re-review every file changed during tasks 9.2 through 9.7 until all terminal
      digests match the final worktree and no review-induced edit remains pending.
- [x] 9.9 Run the completion validator and require zero pending rows, zero invalid rows,
      zero undisposed findings, and zero unproved product exceptions.

## 10. Verification, Reports, and Delivery

- [x] 10.1 Run `pnpm format:check` and every planted formatter/scope probe; record exact
      commands, versions, exit codes, and final artifact digests.
- [x] 10.2 Run `pnpm lint`, confirm every configured owner executed, and record the full
      PASS table with zero errors and zero warnings.
- [x] 10.3 Run `pnpm typecheck`, `pnpm typecov`, and `pnpm build`; record exact commands
      and observed exit codes.
- [x] 10.4 Run `pnpm test` plus focused regression suites referenced by finding evidence
      and record test counts without arithmetic inference.
- [x] 10.5 Run `pnpm test:e2e:integration` against the designated disposable E2E
      database and preserve the production destructive guard.
- [x] 10.6 Run `pnpm lint:p0-evidence`, `pnpm lint:critical-tests`, the ledger validator,
      catalogue check, suppression/scope probes, and `openspec validate --strict`.
- [x] 10.7 Regenerate `consolidation.json`, roadmap, Markdown reports, handoff, and HTML
      from the validated final ledger and record their shared ledger digest.
- [x] 10.8 Render the final HTML and require every Mermaid source to produce a rendered
      diagram with no browser console or page errors.
- [x] 10.9 Record server-side CI as owner-waived, without representing local gates as CI
      or requiring a GitHub Actions run.
- [x] 10.10 Run `git diff --check`, inspect the complete campaign diff, stage only owned
      paths, commit to `main`, push, and verify `HEAD = origin/main` with a clean worktree
      and empty stash.
