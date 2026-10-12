# Proposal

## Why

A valid assistant answer containing a level-four, level-five or level-six Markdown heading falls through to a plain paragraph on the original renderer, contradicting the existing heading-level preservation requirement. C4776 is the only selected correction; external V22 scope/RED evidence records the public response boundary.

## What Changes

- Recognize existing native heading levels4–6 while preserving levels1–3 and semantic bullets.
- Preserve h1/h2 styling; render h3–h6 through one dynamic native heading with the existing h3 treatment.
- Exercise schema-admitted responses through the actual Chat/store/content renderer, with genuine original-product RED and corrected GREEN.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-report-assistant`: clarify original heading-level preservation for levels4–6 within the existing answer surface.

## Impact

Only the owned assistant Markdown renderer and its existing public test. No provider, retrieval, schema, dependency, mutation, storage or access changes. Preserve historical Pi evidence externally.

## Non-goals

- Full CommonMark, ordered-list, quote, link, code-fence or sanitizer policy changes.
- Claims of browser layout or native AT acceptance from DOM tests.
