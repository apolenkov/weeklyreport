## Why

Live page feedback on `/admin?tab=settings` → Integrations: the messaging
integration card is headed "Telegram", but the team's planned channel is
**Element** (the corporate messenger). The user confirmed this is purely a text
change — rename the card's user-facing copy; no backend work.

## What Changes

- **The messaging Integrations card displays "Element" instead of "Telegram"** —
  the `<h3>` heading and the description line. It stays a Coming-Soon / deferred
  card exactly as today (the feature is not built).
- **No backend / transport change.** The underlying not-yet-built dispatch seam
  (the deferred `TelegramBinding` / `TG_BOT_TOKEN` / Phase-55 stub) is unchanged;
  this change touches only the displayed strings. Swapping the actual transport
  to a real Element/Matrix backend is a separate future activation change, not
  this one.
- **The card stays honest.** The current status rows read live Telegram state
  (`telegram.configured` / `telegram.bindings` from `admin.integrationsStatus`),
  so showing them under an "Element" heading would surface Telegram-derived
  status as Element — a false claim when the Telegram transport is configured.
  The Element card therefore drops those Telegram-derived rows: it is heading +
  description + Coming-Soon badge, asserting no messaging status. Naming the
  planned channel "Element" is a roadmap label, not a status claim.

## Capabilities

- `admin-settings-ui` — the Integrations sub-tab's named cards (MODIFIED: the
  "Telegram" card scenario becomes the "Element" card; the "only roadmapped
  integrations" rule is unchanged).

## Impact

- Web: `apps/web/src/components/admin/settings-integrations-sub-tab.tsx` — the
  heading text, the description line, and removal of the Telegram-derived
  `<dl>` status rows from this card.
- Test: `apps/web/src/components/admin/settings-tab.test.tsx` — the assertion
  that the card reads "Telegram" becomes "Element", and the configured/bindings
  row assertions for this card are dropped.
- No schema, no API, no migration, no backend rename. The `admin.integrationsStatus`
  query and its Telegram fields stay (untouched, just no longer rendered on this
  card); internal `data-testid`s stay. Rendering Element-native status is a
  future activation change.
