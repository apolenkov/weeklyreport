# Tasks — integrations-card-element-label

## 1. Rename the card copy (→ "Integrations Sub-Tab Surfaces Only Roadmapped Integrations")

- [x] 1.1 In `apps/web/src/components/admin/settings-integrations-sub-tab.tsx`,
      change the messaging card `<h3>` from "Telegram" to "Element".
- [x] 1.2 Update the description line so it no longer says "Telegram bot" —
      describe the Element messaging channel (push notifications + quick-reply),
      English copy per repo rule. Keep it Coming-Soon.
- [x] 1.3 Remove the Telegram-derived `<dl>` status rows ("Bot configured" =
      `telegram.configured`, "Active bindings" = `telegram.bindings`) from this
      card — they surface Telegram state and must not appear under "Element". Keep
      the `ComingSoonBadge`. Leave the `admin.integrationsStatus` query and the
      AI card UNCHANGED (the Telegram fields stay in the API, just unrendered
      here).

## 2. Test (→ same requirement)

- [x] 2.1 In `apps/web/src/components/admin/settings-tab.test.tsx`, update the
      assertion that the card reads "Telegram" to assert "Element"; keep the
      Coming-Soon badge assertion; DROP the configured/bindings status-row
      assertions for this card (those rows are removed). Add an assertion that no
      Telegram-derived "yes"/binding-count status renders under "Element".

## 3. Gates

- [x] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` green.
- [x] 3.2 Confirm no other production UI string or test still asserts a "Telegram"
      heading on this card (grep), while backend/testid names intentionally stay.
