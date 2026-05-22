---
tags: [jira, integration, deferred, frozen]
aliases: [jira-linkage]
related: [holidays-calendar]
---

# Jira Linkage — deferred (roadmap)

Link report items / SDLC stages to Jira issues so a status row can reference
the originating ticket. Requested during UAT 2026-05-22, explicitly deferred by
the user to the same bucket as dark theme, i18n, holidays, and Telegram —
roadmap-only, not built now.

## Scope (future)

- **Item ↔ Jira issue link**: optional `jiraKey` on an item/position, rendered
  as a chip that opens the Jira issue in a new tab.
- **Config**: Jira base URL + project mapping sourced from a `.jira`-style
  config, not hardcoded (mirrors the existing depersonalized-config pattern).
- **Read-only first**: display + deep-link before any write-back / sync.

## Why Deferred

User direction (UAT 2026-05-22): "можно ещё будет сделать связку с жирой, но
это как к замороженному … можно добавить как к роадмапу". Same freeze policy as
AI/RAG, dark theme, i18n, holidays, Telegram, Director.

## Activation Trace

- No runtime code yet. When activated, follow the deferred-feature pattern in
  the repo `CLAUDE.md`: a `ComingSoonBadge` on an inert control for the
  user-facing surface, or a loud `throw new Error('Not implemented — see
TODO(JIRA-LINK)')` stub for any backend path. Add `TODO(JIRA-LINK)` near the
  activation point.

## Acceptance Criteria

- [ ] `jiraKey` field on item schema (Prisma append-only migration)
- [ ] Config-driven Jira base URL + project mapping
- [ ] Item chip deep-links to the Jira issue
- [ ] No hardcoded UI strings beyond the English baseline
- [ ] TypeScript strict mode passes

## Blockers

- None technical; gated purely by the freeze decision until the user reopens it.
