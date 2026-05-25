# Add Jira linkage

## Problem

Status reports exist in isolation from the Jira issues that drive the work.
Leads manually cross-reference issues when filling risk / decision / item
descriptions. A head reviewing the report has no way to jump to Jira for
context on an issue or track stage status against Jira workflow.

## Solution

Add optional Jira issue linking:

- Extend the `Item` model to include `jiraIssueKey` (e.g., "PROJ-1234").
- Add a text input in `ItemEditDialog` to paste the Jira key.
- Render the key as a link in the report (slide and head-role views).
- (Future: auto-fetch issue summary and status from Jira API.)

## Non-goals

- Bi-directional sync (Jira → report or report → Jira).
- Webhook integration for Jira issue updates.
- Support for linking risks or decisions to Jira (MVP: items only).

## Source

- `.planning/todos/pending/2026-05-22-jira-linkage-deferred.md` — explicitly
  deferred by user alongside dark theme and i18n.

## Activation trigger

When product decides to integrate CustomReport with Jira workflows. Current ETA:
v9.0 or later (roadmap parked, awaiting product direction).
