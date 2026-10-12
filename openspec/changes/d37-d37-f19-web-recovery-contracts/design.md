## Context

F19 retains 20 original cards and 26 original findings, including rejected subclaims and unexecuted native boundaries. Existing shared role maps and query reporting remain authoritative. No server/auth fallback, timing threshold, layout-height policy or log payload redesign is admitted.

## Goals / Non-Goals

**Goals:** fix demonstrated owner-boundary regressions using existing helpers and colocated tests; preserve contracts of all callers.

**Non-Goals:** new dark theme, guessed toolbar height/CLS, stalled navigation timeout/notification/401 policy, native acceptance by DOM class assertions.

## Decisions

The query reporting state requires isSuccess. A ref records whether a toast has been shown; success clears it, pending does not. New error objects still emit logs. The two manually assembled consumers pass their query's success state.

Activity filtering uses the same trimmed needle as its row filter. Its active-empty copy uses isFiltering instead of the full active+archived count. Archived accepted names use the active-row wrapping idiom; browser containment remains separate evidence.

A pure shared navigation builder encodes role/email and an optional explicit redirect. App login supplies ROLE_HOME_PATH[role]; role switch omits redirect. Shared UI never imports the app layer. No transport/sanitizer policy changes.

Search preserves native input focus by preventing result mousedown's default. Existing blur/outside/Escape/keyboard semantics remain with their existing owners. Actual Safari acceptance is not asserted by a synthetic mouse event.

## Risks / Trade-offs

Required isSuccess reveals hand-assembled query states at compile time. Existing query results already provide it. Layout/focus/print/Safari and actual log-sink delivery need Root's native window. A stalled navigation retains the current behavior until a measured policy is admitted; C3227/C3231 stay needs-evidence.

## Migration Plan

No data/schema migration. Root receives exact source patch and before/after seals, runs aggregate gates/native acceptance, then normal hooks/publication.

## Open Questions

Root must measure the chevron token/native geometry before that root receives code; the History toolbar reserve moved to t503-history-toolbar-loading-reserve (native acceptance in the WR lane). Stalled-navigation policy remains unapproved.
