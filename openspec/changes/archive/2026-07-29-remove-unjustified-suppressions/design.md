# Design

## Ledger

The adjudication ledger is keyed by normalized path, directive location, and
rule name. Each entry records:

- observed code shape and installed-rule result;
- verdict: `remove`, `replace`, or `retain`;
- reason tied to current behavior, not history;
- owner: production boundary, test harness, tooling, seed, or configuration;
- proof command and planted adjacent violation;
- implementation commit and resulting baseline.

Line numbers are locators, not identity: the path/rule plus source fingerprint
allows the ledger to survive neighboring edits.

The starting snapshot also preserves 11 `eslint-disable` substrings that were
not directive comments. They have `replace` verdicts against the old raw-string
measurement. The executable inventory uses the TypeScript ESLint parser's
comment stream, so strings and explanatory prose cannot inflate the live
baseline.

## Decision sequence

```text
directive
  |
  +-- rule no longer fires --------------------------> remove
  |
  +-- code can express intent more truthfully ------> replace code, remove
  |
  +-- external/framework typing mismatch is real
        |
        +-- directive is minimal + reason current
        +-- planted adjacent violation still fails --> retain
```

The campaign starts from 126 raw observations: 115 directives and 11
measurement-noise records. It finishes at zero unadjudicated or unjustified
directives. The
retained raw count is discovered from evidence, not selected in advance.

## Verification integrity

Rule probes use the installed ESLint version, plugin version, parser options,
settings, and effective file scope used by `pnpm lint:eslint`. A probe that
constructs a different configuration cannot justify a production exception.
File-wide directives require proof that line-scoped expression is impossible;
otherwise they are narrowed.
