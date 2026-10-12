# Design

## Context

`drainLogs` accepts multiline console transport messages; `findingGroups` interpolates their detail directly into Markdown list entries. `skippedControls` and `pageLine` similarly interpolate free text. Tables already isolate separators and newlines with `cell`.

## Goals / Non-Goals

**Goals:** Preserve one report entry per observed finding/reason/page and keep raw records unchanged.

**Non-Goals:** Change filename/URL targets, locale, timers, retries, standalone status, collection limits or scheduling; run live crawling.

## Decisions

Use one private Markdown-text escape at the existing renderer boundary. Escape Markdown punctuation before flattening line breaks using the same single-line convention as existing table cells. No shared cross-application helper was found; add no dependency or exported test seam. Keep table structure and generated links unchanged. The test supplies a console transport payload through the existing browser test port, then executes actual `drainLogs` and `renderMarkdown`.

Period dual-state, role builders and database guards are preserved: this renderer does not write them. No migration, flags or runtime configuration change is needed.

## Risks / Trade-offs

Multiline Markdown detail is presented on one list line; raw JSON remains the exact observed structured content and carries line breaks. Escaping adds source notation only; rendered text remains literal. Root retains aggregate gates and final independent acceptance; pure renderer tests do not prove native browser crawling.
