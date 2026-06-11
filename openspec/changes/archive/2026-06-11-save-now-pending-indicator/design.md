# Design — Save-Now Pending Indicator

## D1. "Pending" means the mutation in flight, not the autosave `pending` state

The autosave state machine (`use-lead-form-autosave.ts:11`) already has
a state literally named `pending` — it means "dirty, debounce timer
armed, save NOT started yet". The user's feedback says "while the
mutation is pending", which in tRPC/TanStack terms is
`mutation.isPending` — exposed on the snapshot as `isInFlight`
(`isInFlight = saveDraftMut.isPending`, line 256).

**Decision:** the indicator keys off `isInFlight` (the component's
existing `isSaving` local), NOT off `state === "pending"`. A button
that turns green merely because the form is dirty would signal work
that has not started. No renames — touching the state-machine naming is
out of scope.

## D2. Token: `--color-starbucks-accent`, not `--color-primary`

`packages/ui/src/styles/globals.css` defines both
`--color-primary: #006241` and `--color-starbucks-accent: #00754a`.
Repo convention for a filled primary CTA is accent-as-fill with
primary-as-hover-darken (`login-page.client.tsx:307`,
`auth/error/page.tsx:36`, `confirmation-dialog.tsx:127`), all paired
with `text-white`.

**Decision:** pending fill = `bg-[var(--color-starbucks-accent)]
text-white border-[var(--color-starbucks-accent)]`. No hover variant —
the button is disabled while pending, so hover styling is moot.

## D3. Revert-on-settle needs no new code path

The fill is a pure function of `isInFlight`. When the mutation settles,
`saveDraftMut.isPending` flips false, the snapshot re-renders, and the
conditional class evaluates back to the idle styling — for both the
success branch (check icon, then 1500 ms revert) and the error branch
(alert icon, click retries). No effect, no timer, no cleanup.

The success `CheckIcon` keeps its hardcoded success stroke and the
error `AlertIcon` keeps `currentColor` against the default foreground —
both render on the _settled_ (non-accent) background, so no icon
changes are needed.

## D4. Disabled washout vs. the green fill

The shared class string ends in `disabled:opacity-40`. The pending
button is disabled by design (repeat clicks blocked), but a 40 %-opacity
green reads as a broken button, not as "working".

**Decision:** while `isInFlight`, override with full opacity
(`disabled:opacity-100` in the pending branch). The idle/saved disabled
states keep the existing 40 % washout. `disabled:cursor-not-allowed`
stays in both branches.

## Invariants check (per config rules)

Preserved untouched: period dual-state, role-coverage gate,
destructive-db guard, deferred-feature pattern. No request path, Prisma
write, or shared schema is involved — data flow is unchanged
(tRPC mutation → hook snapshot → component prop, already shipped).

Extended: `lead-report-controls-integrity` gains an ADDED requirement
("In-flight control actions show a visible busy state") — the same
durable spec that already governs this toolbar's control behavior. See
`specs/lead-report-controls-integrity/spec.md` in this change.
