## Context

`ActivityLivePanel` already computes the focused live-report URL for every row, but renders it only for `hasContent && !isDraft`. Draft rows with content use an inert `<div>` despite being the head's pre-deadline review target.

## Goals / Non-Goals

**Goals:** link every content-bearing row and keep truly empty rows inert.

**Non-Goals:** change report access, editability, status, or URL shape.

## Decisions

Use `hasContent` as the sole interactivity condition. Both draft and submitted rows render the same anchor, focus ring, hover affordance, and `/head/report/[reportId]?authorId=[leadId]` target. Status pills continue to communicate draft/submitted state. Zero-content rows remain non-interactive because there is no report content to focus.

This is an anchor rather than an imperative router click so keyboard behavior, link semantics, copy/share, and open-in-new-tab work without additional handlers.

## Risks / Trade-offs

- Existing tests encode the bug as expected behavior → replace them with semantic link and empty-row assertions.
- Draft copy could imply editing → label the destination as opening the report section and preserve read-only head surface behavior.

## Invariants

The route and authorization gates are unchanged. No load-bearing invariant is modified.
