# Morning handoff — fix-report-surface-integrity (built overnight 2026-06-15→16)

Bottom line: **the change is fully implemented (W1–W11) on `feat/fix-report-surface-integrity`,
gate-green, UAT-clean, and Codex-reviewed (code APPROVED in substance).** NOT pushed — branch + PR
is your call.

## What got done (35 commits vs main)

- **W11** (the headline "6/7 lie"): completeness now counts a stage covered by the lead's OWN
  risk; mapper + bridge use a STRICT predicate (own non-empty risk that explicitly names the
  stage — covers-all/legacy/foreign never count); reload-stable; chip distinguishes "by risk" vs
  "— status set"; risk dialog no longer defaults all stages on product switch.
- **W6**: deviation confirmed + recorded — stage-color parity was already satisfied; the mapper
  PRESERVES raw status and only adds `coveredByOwnRisk` (flooring it would break W11). PDF/head use
  product `worstStatus`.
- **W7/W8**: one shared `buildEscalationsFromReadSections` for live + snapshot parity; multi-stage
  names join; "No stage set" for legacy; product names resolve from the authorized read model (no
  unscoped query, no more "Unknown").
- **W1/W2**: lean head header; one labeled Export-PDF in the toolbar trailing group; Present +
  browser-Print links removed; `/present` → 308 `?mode=slides`; `/print` split into a server gate
  (worker token via `auth.printGate`) + client template, human → 307; lead is FORBIDDEN from
  pdfExport (leadershipProcedure) and sees an inert ComingSoon control everywhere (incl. preview).
- **W3/W4/W5/W9**: one combobox period navigator (useId-scoped ids, `HeadPeriodNavigator` dropped),
  per-lead submitted markers from real `submittedAt`; ScopeToggle restyled; KPI "Active leads" →
  "Submitting leads".

## Verification

- Full gate GREEN: `npx prisma generate && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  (web 1132 tests, api 920). `openspec validate fix-report-surface-integrity --strict` green.
- Live UAT (Haiku + Playwright, all 4 roles) = clean — see the workflow result; only expected
  observability noise (Sentry/agentation localhost not running).
- Codex code review: 4 fresh-session rounds. All invariants PASS from round 2; the REVISE verdicts
  were spec-delta + comment drift (all fixed) plus one pre-existing main-spec heading nit. Detail:
  `CODE-REVIEW-LOG.md`.

## What's left

1. **Open the PR** (push the branch). Push to main is fine via the pre-push gate, but the repo norm
   is branch + PR — your call.
2. **One genuinely-unverified-live item**: the W6 floor through the _published PDF export_ path. It
   is test-guarded at the product-`worstStatus` level, but no one published a report + exported a
   PDF in the browser. Worth one manual check before archive (publish a report with an
   empty-but-risk-covered stage, export, confirm the product status reflects the risk).
3. **Pre-existing nit (optional cleanup, not this change):** `role-coverage-gate` main spec heading
   says "Eight" but the body says "9" builders — fix via a RENAMED-requirement in a separate change.
4. **Archive** (`openspec archive fix-report-surface-integrity`) only AFTER the PR merges (task 5.2).

## Kickoff for the PR

```
git push -u origin feat/fix-report-surface-integrity
gh pr create --fill   # or with a body summarizing W1-W11
```
