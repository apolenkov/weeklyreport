# allow-deadline-explicit-clear

## Why

F16 (followups, wave 1): `web-polish-lows` requires edit-mode clears of
`periodEnd`/`deadline` to reach the server as explicit `null`, but the update
wire schema types both as `optional()` without `.nullable()` and
`Report.deadline` is NOT NULL in the DB — «удали дедлайн» неотличимо от «поле
не трогал», the spec clause is unimplementable as written.

**Ruling (Sasha, 2026-07-24): вариант (а)** — make the explicit clear real:
a period's deadline becomes genuinely optional end-to-end and can be removed
by an admin. `periodEnd` is NOT part of the ruling — a period must end, so
clearing it stays a loud validation error (current behavior).

## What Changes

- `prisma/schema.prisma`: `Report.deadline` → nullable (`DateTime?`); MVP
  mode — reshape + `migrate reset`.
- Wire schema (`packages/shared`): period-edit `deadline` becomes
  `.nullable().optional()` — three distinguishable states: absent (untouched),
  `null` (explicit clear), value (set). `periodEnd` unchanged.
- Update service: diff maps `deadline: null` to a real clear; audit event
  `period.manual-edit` carries `{ from: <iso>, to: null }`.
- Every deadline consumer handles absence EXPLICITLY (no silent fallback,
  per the no-fallback rule): deadline gate → inactive with a logged reason;
  deadline-relative reminder policies → no executions for that period;
  UI badge/countdown → "No deadline" state, not a crash or an epoch date.
- Admin UI: the deadline field gets a real clear affordance; clearing and
  saving deletes the deadline (confirm dialog states the consequence).
- Specs: `web-polish-lows` clause narrowed to deadline-only explicit clear;
  period-lifecycle/reminder specs gain the null-deadline scenarios.

## Impact

- DB reshape (dev/test DBs disposable), shared Zod schema, api period
  update path + reminders/deadline-gate consumers, admin period form.
- Risk: a consumer silently assuming deadline is always present. The
  consumer audit task (1.1) is the gate for the rest of the change.
