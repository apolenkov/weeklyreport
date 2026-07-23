# Tasks

## 1. Audit (gate for everything below)

- [x] 1.1 Enumerate EVERY consumer of `Report.deadline` (api: reminders,
      deadline gate, auto-publish, analytics, pdf/email templates; web:
      badges, countdowns, admin form; e2e fixtures). For each: define the
      explicit null-deadline behavior. No consumer may keep an implicit
      "deadline is always set" assumption. → **`audit.md` in this change
      (2026-07-24): per-consumer table, decision-deadline column excluded,
      sentinel-date alternative rejected.**

## 2. Schema + contracts

- [x] 2.1 `prisma/schema.prisma`: `Report.deadline DateTime?`; reset+seed
      dev/test DBs (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`).
- [x] 2.2 `packages/shared` period-edit schema: `deadline:
z....nullable().optional()`; `periodEnd` unchanged. Schema-surface
      test pins the three states.
- [x] 2.3 Update service diff: `null` → real clear; audit envelope
      `changes.deadline = { from, to: null }`; no-op edit still emits
      nothing.

## 3. Consumers (per audit 1.1)

- [x] 3.1 Deadline gate: absent deadline → gate inactive, reason logged
      loudly (extends the F13 fail-loud direction, never silent-off).
- [x] 3.2 Deadline-relative reminder policies: no executions for a
      no-deadline period; escalation/deadline templates never render an
      empty date.
- [x] 3.3 Web: period badge/countdown/admin form show an explicit
      "No deadline" state; clear affordance + consequence-stating confirm.
      **Deviation: the consequence is an always-visible inline hint under
      the cleared field (stronger than a click-through confirm dialog);
      pinned by test.**
- [x] 3.4 Auto-publish/analytics/pdf-export: null-deadline branches explicit
      and covered by tests.

## 4. Specs

- [x] 4.1 Delta `web-polish-lows`: clause narrowed to deadline-only explicit
      clear; periodEnd clear = validation error.
- [x] 4.2 Delta for the reminder/deadline-gate capability: null-deadline
      scenarios.

## 5. Gates

- [x] 5.1 Unit + integration suites green; new null-deadline tests have
      teeth (assert behavior, not absence).
- [x] 5.2 `pnpm typecheck`, `pnpm lint` (or deferred-lint list while the
      toolchain is down), `openspec validate allow-deadline-explicit-clear
--strict`.
