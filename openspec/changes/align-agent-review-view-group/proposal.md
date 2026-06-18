# Align the Agent-review placeholder spec with right-aligned view controls

## Why

`toolbar-compact-icon-controls` split the context bar into two clusters — period
navigation anchored left, the view controls pushed right by a flex spacer — and
the Agent-review placeholder now leads that right-aligned view group. The
`head-toolbar-semantics` "Deferred placeholders render visually subordinate"
requirement still says the placeholder is "the first element of the group" of the
whole context bar, which is now false (the period navigator is first). This
amendment corrects the requirement to match the shipped placement.

## What Changes

- Re-scope the placeholder's "leading edge" rule: in the report toolbar it leads
  the **right-aligned view-control group** (which follows the left-anchored
  period navigation), not the whole bar. Compact + inert + ComingSoon-tooltip
  semantics are unchanged.

## Out of scope

- Any code or behavior change — this is a spec-text correction only.

## Impact

- Affected specs: MODIFIED `head-toolbar-semantics` (Deferred placeholders
  requirement wording + scenario).
- No code changes.
