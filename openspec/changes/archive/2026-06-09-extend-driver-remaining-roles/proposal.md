# Extend the AI-Driver Fan-out to the Remaining Roles

> **Coordination.** This is the split-out of task 5.1 from
> `behavioral-ui-regression-gate` (archived 2026-06-08). That change built and
> proved the AI-Driver against the `lead` role; the per-role fan-out to
> `head`/`admin`/`viewer` was explicitly deferred there ("reopen when those
> roles are scoped"). This change is that reopening. It builds nothing new — it
> runs the existing Driver protocol on three more roles.

## Why

The AI-Driver (live Playwright-MCP exploration that finds within-route
flow/logic bugs the Layer-1 sweep cannot see) has only been run against `lead`,
where it surfaced 2 real bugs. `head`, `admin`, and `viewer` have durable
catalogs but have never been driven, so their within-route behavior is
unverified.

## What Changes

- Run the existing AI-Driver protocol (`e2e/sweep/driver/drive-prompt.md`)
  against `head`, then `admin`, then `viewer` — one role at a time, reusing the
  shared single-browser drive + the `lead-driver-verify` adversarial-verify
  workflow. No new harness, prompt, or workflow is authored.
- Record per-role Driver reports in the established `role · route · anomaly`
  shape (generated, gitignored under `e2e/sweep/.reports/`).
- Disposition every adversarially-confirmed bug: fix-here, defer-with-reason, or
  split to its own change — the same discipline used for the 2 `lead` findings.

## Capabilities

- **New Capabilities**: `ai-driver-coverage` — `behavioral-ui-regression-gate`
  built a swappable Driver and required a per-role _report_ sweep, but it ran
  the **AI-agent** Driver only on `lead` and explicitly deferred the rest. This
  change introduces the durable requirement that the AI-Driver exploratory pass
  covers every role, with a verified capture path and dispositioned findings.
- **Modified Capabilities**: None. The within-route scenarios themselves stay
  run-time and are deliberately NOT frozen into specs (see ADR 0001 and
  `e2e/catalog/README.md`); only the _coverage_ obligation is specified.

## Impact

- No production code unless a confirmed bug warrants a fix (each fix lands with
  its own test + disposition note, as in the `lead` run).
- Generated reports only; no new dependencies. Requires the live app
  (dev-auth + Playwright MCP), so this is an interactive, token-heavy run
  (the `lead` drive alone was ~171 MCP tool-uses).
