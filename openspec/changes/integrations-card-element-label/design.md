# Design — integrations-card-element-label

## Context

Live feedback on `/admin?tab=settings` → Integrations. The user confirmed twice
this is "just a text change": rename the messaging card from "Telegram" to
"Element". Scope is deliberately UI copy only.

## Decisions

### UI copy only — no transport rename

Only the displayed `<h3>` heading and the description string change
(`settings-integrations-sub-tab.tsx`). The not-yet-built dispatch seam — the
deferred `TelegramBinding` model, `TG_BOT_TOKEN`, the Phase-55 dispatch stub
governed by `deferred-feature-pattern` — is untouched. Internal `data-testid`s
(`integration-row-telegram`, etc.) and the `admin.integrationsStatus` field names
stay; renaming them is churn with no user benefit and would break status wiring.

### Honesty is preserved by dropping the Telegram-derived status rows

The `admin-settings-ui` honesty rule requires a card to assert nothing false. The
existing status rows read LIVE Telegram state — `telegram.configured` /
`telegram.bindings` from `admin.integrationsStatus`, computed from `TG_BOT_TOKEN`
and active `TelegramBinding` rows (tests cover `configured: true, bindings: 4`).
Showing those under an "Element" heading would surface Telegram status as Element
— false when the Telegram transport is configured (Codex review caught this). So
the Element card DROPS those rows: heading + description + Coming-Soon badge only,
asserting no messaging status. Naming the planned channel "Element" is then a pure
roadmap label. Rendering real Element-native status belongs to a future
activation change. The `admin.integrationsStatus` Telegram fields stay in the API
(unrendered here), so no backend change is needed.

### Known, intentional tension (recorded so it isn't a surprise)

After this change the UI names the planned channel "Element" while the internal
deferred transport is still the Telegram seam. That is acceptable BECAUSE the
feature is unbuilt — the displayed name is the roadmap target, the internal seam
is an implementation placeholder. Fully swapping the transport (model, env, queue,
dispatch stub, `deferred-feature-pattern` wording) to a real Element/Matrix
backend is a SEPARATE future activation change, explicitly out of scope here.

## Out of scope

- Any backend / schema / queue / env change.
- Renaming `TelegramBinding`, `TG_BOT_TOKEN`, the dispatch stub, or the
  `deferred-feature-pattern` spec.
- Renaming internal `data-testid`s or `admin.integrationsStatus` fields.
