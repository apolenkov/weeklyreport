# Tasks

## 1. Audit (gate for everything below)

- [ ] 1.1 Enumerate EVERY consumer of `Report.deadline` (api: reminders,
      deadline gate, auto-publish, analytics, pdf/email templates; web:
      badges, countdowns, admin form; e2e fixtures). For each: define the
      explicit null-deadline behavior. No consumer may keep an implicit
      "deadline is always set" assumption.

## 2. Schema + contracts

- [ ] 2.1 `prisma/schema.prisma`: `Report.deadline DateTime?`; reset+seed
      dev/test DBs (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`).
- [ ] 2.2 `packages/shared` period-edit schema: `deadline:
    z....nullable().optional()`; `periodEnd` unchanged. Schema-surface
      test pins the three states.
- [ ] 2.3 Update service diff: `null` → real clear; audit envelope
      `changes.deadline = { from, to: null }`; no-op edit still emits
      nothing.

## 3. Consumers (per audit 1.1)

- [ ] 3.1 Deadline gate: absent deadline → gate inactive, reason logged
      loudly (extends the F13 fail-loud direction, never silent-off).
- [ ] 3.2 Deadline-relative reminder policies: no executions for a
      no-deadline period; escalation/deadline templates never render an
      empty date.
- [ ] 3.3 Web: period badge/countdown/admin form show an explicit
      "No deadline" state; clear affordance + consequence-stating confirm.
- [ ] 3.4 Auto-publish/analytics/pdf-export: null-deadline branches explicit
      and covered by tests.

## 4. Specs

- [ ] 4.1 Delta `web-polish-lows`: clause narrowed to deadline-only explicit
      clear; periodEnd clear = validation error.
- [ ] 4.2 Delta for the reminder/deadline-gate capability: null-deadline
      scenarios.

## 5. Gates

- [ ] 5.1 Unit + integration suites green; new null-deadline tests have
      teeth (assert behavior, not absence).
- [ ] 5.2 `pnpm typecheck`, `pnpm lint` (or deferred-lint list while the
      toolchain is down), `openspec validate allow-deadline-explicit-clear
    --strict`.
