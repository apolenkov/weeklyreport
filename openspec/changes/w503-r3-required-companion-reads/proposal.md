# Proposal

## Why

Commit 44eae8e8a (C4907/C4909) made the view-settings and cross-author reads
required reads of the Lead form: their failure shows the shared load error with
Retry instead of silent defaults. The `lead-form-data-loading` requirement still
lists only the active-period, section and history reads (review finding F2).

## What Changes

- The "Required Lead reads expose recoverable terminal outcomes" requirement
  includes the view-settings and cross-author reads, which wait for the section
  fetch like the section itself.

## Capabilities

### Modified Capabilities

- `lead-form-data-loading`

## Impact

- Spec only; code is `use-lead-form-required-reads.ts` and `use-lead-form-queries.ts`.
