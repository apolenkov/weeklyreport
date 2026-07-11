# Design: add-status-ssot-lint-gate

## Context

Both SSOTs live in `packages/shared/src/schemas/report-primitives.schema.ts`:
`TrafficLightStatus` (`z.enum(["green","yellow","red"])`, :49-55) and
`ReportStatus` (`z.enum(["draft","published"])`, :94-99), each pinned by a
Prisma-to-shared identity test. Enforcement today: convention plus one ESLint
restricted-import entry on `apps/api/src/modules/admin/admin-shared.ts`
(Zone 4, `eslint.config.ts:707-736`).

Repo-verified inventory (2026-07-11):

- Literal-union occurrences: `activity-alarm.ts:12` is a two-color subset
  (legal composition), `lead-history.ts:38` is a four-value presentation
  vocabulary spanning two lifecycles (Codex-traced: section `draft|submitted`
  - compiled-report `published|archived` — NOT a `ReportStatus`
    re-declaration), `dashboard.ts:99` + `dashboard-mock-data.ts:60` carry a
    dead `"active"|"published"|"draft"` field (mapper hardcodes `"published"`,
    zero consumers), `prisma/seed-constants.ts:309` is the documented mirror.
- 22 non-test api files genuinely import `@prisma/client` outside
  `infrastructure/`; all are sanctioned categories (admin query internals,
  auth routes/session, carry-over writers, applicators in `application/`,
  `*.prisma-repository.ts` adapters, lib helpers, row mappers).
- Port-declaring files (module service/contract files) import no
  `@prisma/client` today — the boundary is clean and can be pinned as-is.

Design grilled with Codex to consensus (two rounds, 2026-07-11).

## Goals / Non-Goals

**Goals:**

- A regression gate that makes re-declaring either SSOT union a commit-time
  and sweep-time failure, including in test files.
- A pinned, general port-type boundary that cannot silently regress when new
  port files appear.
- Remove the one piece of dead status vocabulary the sweep surfaced.

**Non-Goals:**

- No repo-wide reclassification of the 22 sanctioned Prisma importers.
- No consolidation of the presentation vocabulary triple declaration (owned
  by `status-presentation-model`, separate follow-up).
- No `TRAFFIC_RANK`/`statusSeverity` ranking dedup (separate follow-up).
- No annotation escape hatch in the scanner.

## Decisions

1. **Standalone `.mjs` scanner over an ESLint rule.** The check is a narrow
   cross-file SSOT policy needing staged-file and `--all` modes; a
   `no-restricted-syntax` selector matching arbitrary union orderings would be
   brittle, and ESLint zones already exclude some test globs — the scanner
   covers every staged `.ts`/`.tsx` uniformly (Codex concurs).
2. **Detection rule.** Flag a union type or `z.enum` literal list when its
   status-literal set contains all of `green`, `yellow`, `red` — extras
   allowed (three colors only ever come from the SSOT), or equals exactly
   `{draft, published}` — supersets tolerated because traced supersets
   (`lead-history.ts`) are genuinely distinct vocabularies. Exact-set for
   ReportStatus stays honest because the one superset violation
   (`dashboard.ts`) is deleted by this change, not allowlisted.
3. **Allowlist is hardcoded and central**: the SSOT file itself and
   `prisma/seed-constants.ts` (documented tsconfig carve-out). Future
   exceptions must edit the scanner and its test — no inline escapes, so
   violations cannot be locally suppressed.
4. **Port boundary = explicit file inventory in Zone 4.** No `*.port.ts`
   naming convention exists; an honest explicit list beats a vague glob.
   A dedicated Zone 4b bans `@prisma/client` (value AND type — but not Nest,
   which these files legally use) in the port-declaring service/contract
   files: activity, analytics, archive, carry-over, organization, pdf-export,
   period, project-activity, publication, reminders, report-sections, review
   incl. `review-actions`, search, telemetry incl. gauges, weekly-report.
   `lead-form-shared.ts` needs no Zone 4b entry — it lives under the stricter
   Zone 4 `report-sections/domain/**` glob. Every listed file is Prisma-clean
   today, so the extension is behavior-neutral.
5. **Dead vocabulary removal over allowlisting.** `ArchiveReport.status`
   (model + mock duplicate + `MOCK_ARCHIVE`) is deleted on traced evidence;
   composing `ReportStatus | "active"` would preserve a field nothing reads.
6. **Wiring both paths.** lint-staged runs the scanner on staged files
   (catches new violations pre-commit); `pnpm lint` gains
   `lint:status-literal-unions` running `--all` (catches rebases, hook
   bypasses, drift). Same dual-path shape as `find-archaeology.mjs`.

## Risks / Trade-offs

- **Exact-set rule misses future `ReportStatus`+extra unions.** Accepted:
  supersets are ambiguous by evidence (one traced legit, one traced dead);
  the spec requirement records intent, review owns the judgment call.
- **The port-file inventory can go stale** (a new port file lands outside the
  list). Mitigated by a scanner-adjacent inventory note in the spec and the
  gate's presence in review checklists; a naming convention is a possible
  future hardening, out of scope here.
- **Regex-based union parsing has false-negative room** (unions split across
  helper types). Accepted for a regression gate: it must catch the common
  regression (literal re-declaration in one place), not be a type checker.
