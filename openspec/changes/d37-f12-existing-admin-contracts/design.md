# Design

## Context

Current baseline and full draft/original provenance are in the D37-F12 durable handoff. Owner-boundary tests run the actual seed writer, public React consumers and accessible-label formatter. Genuine RED precedes producer edits. The existing safe admin truncator and Reminder validation-reason code remain untouched.

## Goals / Non-Goals

Goals: truthful visible counts/copy, preserved invalid drafts, restoration to a mounted keyboard target, intact short Unicode references, a truthful deterministic audit example, and removal of current dead/duplicated wiring.

Non-goals: new product policy, streaming/parser/runtime/dependency changes, new public helpers, data/authorization writers, speculative performance fixes and author native acceptance.

## Decisions

- Jobs retains loaded-row search and unfiltered Load more. Only its header separates matches from loaded data, using the existing Actions presentation. Products uses the same current search and product deep-link conditions as its row filter.
- Offset reseeding updates its committed magnitude while retaining any invalid raw draft and alert. Valid input retains its prior reseed behavior. No effect or parent callback during rendering is added. Numeric parsing is unchanged; only the error names the existing integer rule.
- Closing a hidden edit restores focus to the existing search control; visible edit and add keep their original targets. No unsupported-platform escape fallback is introduced.
- shortItemLabel follows the established Intl.Segmenter pattern locally; short strings, whitespace flattening, UTF-16 budget and ellipsis stay unchanged. Importing an admin formatter into shared code would invert the dependency direction.
- Seed data flow before: seedAdminExamples → userActionLog.upsert create/update with review.publish. After: same delegates and fixed actor/target/allowlist, with period.publish matching actual period router registration. No business publish runs; historical unknown procedures remain readable.
- Type-only service imports alter no canonical middleware reference or router registration. Settings mapping preserves order/value/label and dialog deletion preserves active/retained archived group selection.

## Risks / Trade-offs

Unicode labels may be slightly shorter at a grapheme boundary. Focus and layout need native/AT acceptance; jsdom is limited evidence. Seed delegate capture is not PostgreSQL reseed/Actions browser proof. No migration or flag rollout is required. Period dual-state, seven canonical procedure builders including Lead, destructive guard and audit privacy remain unchanged. Root owns normal hooks, publication, aggregate gates and final independent review.
