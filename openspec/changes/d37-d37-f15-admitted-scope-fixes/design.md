## Context

The exact baseline already has latest-status Trends ordering, Less labels, unique diagnostic keys, workflow expanded-state and bounded feedback scope accounting. Historical original findings remain preserved separately; they do not override current contracts.

## Decisions

- Preserve existing query stableId and relation projection fields in one private record include fragment. Record comments originally have no order key; do not introduce createdAt chronology. Existing review and activity/product tie controls remain unchanged.
- Sort mapped sections with authorName.localeCompare(other.authorName, "ru"), matching the live preview. Retain the existing author.name/id query order and stable equal-name input order. The real builder test supplies shuffled Cyrillic/Latin authors; it checks frozen output, ownership, input immutability and equal-name stability without mocks.
- One shared asTrafficLight helper delegates to canonical trafficLightStatusSchema. The existing shared barrel exports it for a real persistence consumer; persistence retains its existing asTraffic export as an alias. No new coercion, logging, default or vocabulary.
- Keep the existing collapse animation and add inert/aria-hidden to its inner content wrapper. DOM attributes do not prove browser AX or AT behavior.
- Keep Remind live feedback and revoke curated-message policy. Existing behavioral owner tests reproduce baseline accessible-name and transport-copy failures.
- Keep feedback capabilities, workflow handlers/focus/destructive behavior and fixed same-origin Agentation route. Style, dead prop and endpoint ownership are mechanical maintenance; no fabricated runtime RED.

## Verification and limitations

Native Root correction retains original executor artifacts and failures immutably. Fresh serial one-file command receipts bind actual exits, durations and full log hashes to source bytes. PostgreSQL collation, browser/AX/AT, geometry, full gates, independent review and canonical acceptance remain NE until Root performs their lanes.
