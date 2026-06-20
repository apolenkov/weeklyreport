# Plan Review Log: polish-decision-owner-and-comingsoon-tooltip

Act 1 (grill-with-docs) complete — change authored autonomously (user asleep);
decisions self-answered, `CONTEXT.md` "Decision" entry updated. MAX_ROUNDS=5.

## Independent diff review (pre-Act-2, background agent) — APPROVED

- Owner persistence + mine/foreign/lock intact: `owner = decision?.owner ?? defaultOwner ?? ""`; `isMine("")` is permissive; the Edit affordance renders only for `mine && !decision.foreign`, so a co-owner's decision can never be silently re-owned.
- No orphans: no leftover `errors.owner`, `dec-owner`, `Owner is required`, `aria-readonly`, or placeholder strings.
- No other `title="Coming Soon"` in source.
- a11y: the Holidays tab's accessible name is "Coming Soon" at 1100px (below `xl`) both before and after the change — zero regression (the badge text stays in the a11y tree via `opacity-0`, not `display:none`).
- Layout clean; test teeth proven (inject the title → the source scan fails → restored byte-identical).
- Non-blocking notes folded in: the `owner=""` edge is documented as benign in `design.md`; a Holidays-tab accessible-name runtime assertion was added (`settings-tab.test.tsx`, 30 passed).

## Act 2 (Codex adversarial review)

**Invocation note (researched 2026-06-20).** A bare `codex exec` hung at 0% CPU
twice (10h17m overnight; a retry stalled from the 20s probe, killed at 280s).
`codex doctor` shows websocket ✓ with a 15s connect timeout, so this is NOT a
proxy/connect failure (that self-resolves in 15s) — it is a response stall while
the subscription quota is throttled, and Codex has no per-request response
timeout, so it hangs forever. The reliable route is the connected runtime: the
`codex:codex-rescue` agent / `/codex:review` / `codex exec review`, not a fresh
bare `codex exec`.

### Round 1 (via the `codex:codex-rescue` runtime) — VERDICT: REVISE

One finding: `decision-edit-dialog.tsx` — `defaultOwner` is optional, so a
create-mode decision could save with `owner=""`, and `isMine("")` returns "mine".
Codex read this as "erroneously allows editing" and proposed making
`defaultOwner`/`currentUserName` required or guarding the save.

### Claude's response (final arbiter) — REJECTED, with reason

`isMine` is permissive _by design_ (`!me → true`, `!owner → true`, with explicit
comments). An empty owner behaving as "mine" lets the author keep editing their
OWN row — not a bug. The path is unreachable in production (every mount passes
`currentUser.name`; co-owners' rows are locked, Edit only renders for
`mine && !foreign`). The proposed fix would invalidate the `decisions-section`
snapshot/add-signal tests that deliberately rely on the permissive `isMine`
fallback — disproportionate churn for an impossible path. Full rationale in
`design.md` → "Benign `owner=""` edge". No code changed; the change stands.

The change is otherwise supported by Act 1 (self-grill + glossary), the
independent diff review (APPROVED), the gates (typecheck 5/5, lint 0, prettier
clean, full web vitest 1225 + the Holidays test), and the live browser check.
