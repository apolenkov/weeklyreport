# Proposal

## Why

A console error containing a newline and Markdown marker currently creates another heading or list item in the crawler report. The report must display the observed message as text so a reader can distinguish evidence from report structure (D37-V12 C4157).

## What Changes

- Clarify existing `ui-crawl` evidence readability for finding detail, page labels and skip reasons.
- Escape only those free-text fields in Markdown output, retaining the original structured findings and steps.
- Verify the existing `drainLogs` to `renderMarkdown` path with a multiline console transport payload.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: free-text evidence cannot introduce Markdown headings or list items.

## Impact

`scripts/ui-crawl/report.ts` and the existing `report-statistics.test.ts`; no dependency changes. Sources: `logs.ts` preserves observed console text, `report.ts` already escapes table separators and line breaks, and `openspec/specs/ui-crawl/spec.md` requires observable evidence rather than inferred acceptance. Raw JSON remains authoritative and unchanged.

## Non-goals

- Filename, locale, retry, timer, standalone completion-banner or crawler scheduling policies.
- Live crawling, browser/API/DB/cloud checks in the author window.
- Shortening or mutating messages, stack traces or other raw structured evidence.
