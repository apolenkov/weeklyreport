# Design

## Context

See proposal.md for motivation. Implementation is based on main `3009ba73be6c7dc576bac0f426012d43d5881373`, after TASK-503.104, TASK-503.106 and TASK-503.108 delivery. The selected-character predicate on that baseline still admits residual DICP-only input. TASK-503.106's exported `hasVisibleText` is the production owner shared with clients; its public export and caller API stay unchanged. The existing primary invisible-text table owns the regression. Original preparation freezes and current execution evidence live in `task-503/invisible-107/`.

```text
Before: new writes + stored reads -> selected shared content predicate
After:  new writes -> shared full-DICP presence predicate -> original string
        stored reads -> .108 read-compatible schemas -> original stored string
        client hints -> .106 shared production classifier
```

## Goals / Non-Goals

Extend the existing production classifier after .106's handoff; do not add a test-only export, duplicate helper or new dependency. This change does not implement .108, normalize text or classify arbitrary font-dependent invisibility. Period dual-state, canonical role middleware and destructive-database guards remain unchanged.

## Decisions

Policy A approved by 008 uses ECMAScript whitespace plus the entire binary DICP property, including reserved members. A presence-only Unicode property check is preferred to a manually maintained list; successful input is returned unchanged. Reserved non-DICP points and ordinary combining marks remain outside the blank set. Existing null/length rules apply independently.

Prepare independent literal rejection rows and exact-string positive controls in the existing primary test. Cover write-stage validation separately because its schema wiring can regress independently. Leave stored-read tests to .108's owner (011); its distinct claimed files avoid overlap. After .108 lands, reconcile the historical current-read assertion in the existing table with that delivered read contract instead of reintroducing write validation on reads.

The .108 dependency is satisfied only by its delivered main SHA and read-compatibility evidence, not by a prepared branch or planned split. Actual read models now use `storedText` and `storedStageNamesField`; the historical `currentStageNamesField` export no longer owns those reads. Remove the obsolete current-read branch from the primary write-stage table, retain the write assertions, and exercise a real read model with stored U+3164-only prose and stage names. The delivered .108 suite additionally owns selected-character stored-read regressions. This distinguishes new full-DICP compatibility from a fallback allowing only the old selected set.

The authored family samples are sufficient for an implementation using the standard Unicode property. Replacing it with a handwritten character class would require full-range coverage before acceptance; the current sampled table alone would not justify that alternative. Claude C's independent review evaluated copied predicates on Node and observed the intended residual-case differences and accepted controls. That evidence does not execute `safeText` or `writeStageNamesField` through Zod and does not replace the granted Vitest RED/GREEN run.

### Engine and Unicode acceptance record

| Target            | Engine identity                                                     | Unicode evidence                                                                                                    | Status                                                                |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Pinned local Node | Node 26.11.1; previously observed V8 14.6.202.34-node.37 / ICU 78.3 | Unicode 17.0, confirmed by the tagged Node ICU header [1]                                                           | Documentation confirmed; no new execution                             |
| Chrome >=117      | Baseline Chromium 117.0.5938.62                                     | Unicode 15.0: release DEPS pins ICU `de4ce007`, whose header declares 15.0 [2][3]; V8 property parsing uses ICU [4] | Source-derived baseline; no browser execution                         |
| Edge >=117        | Baseline Edge 117 / equivalent Chromium 117                         | Expected Unicode 15.0 from Chromium; Microsoft documents equivalent Chromium major releases [5]                     | Inference; Microsoft build's data not independently verified          |
| Firefox >=119     | Baseline Firefox 119.0 release                                      | Unicode 15.0 in release-tagged bundled ICU header [6]                                                               | Documentation confirmed; no browser execution                         |
| Safari >=17.4     | Baseline WebKit source `7618.1.15.11.12`                            | RegExp property data Unicode 15.0.0: bundled UCD plus Yarr generator [7][8]                                         | Source-derived baseline; no Safari execution or OS-wide Unicode claim |

Sources checked on 2026-10-15, without starting Node, a browser or the classifier:

- [1: Node 26.11.1 `uchar.h`, `U_UNICODE_VERSION`](https://raw.githubusercontent.com/nodejs/node/v26.11.1/deps/icu-small/source/common/unicode/uchar.h).
- [2: Chromium 117.0.5938.62 DEPS, ICU and V8 revisions](https://raw.githubusercontent.com/chromium/chromium/117.0.5938.62/DEPS).
- [3: Pinned Chromium ICU `uchar.h`, Unicode 15.0](https://chromium.googlesource.com/chromium/deps/icu/+/de4ce0071eb47ed54cbda54869001210cf3a8ae5/source/common/unicode/uchar.h).
- [4: Pinned V8 RegExp parser, ICU property lookup](https://raw.githubusercontent.com/v8/v8/71aa74fabc861a8169d43ec19c47cdc71c7edec9/src/regexp/regexp-parser.cc).
- [5: Microsoft Edge release schedule, equivalent Chromium releases](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-release-schedule).
- [6: Firefox 119 release-tagged ICU `uchar.h`](https://hg.mozilla.org/releases/mozilla-release/raw-file/FIREFOX_119_0_RELEASE/intl/icu/source/common/unicode/uchar.h).
- [7: WebKit 7618.1.15.11.12 bundled `DerivedCoreProperties-15.0.0.txt`](https://raw.githubusercontent.com/apple-oss-distributions/WebKit/WebKit-7618.1.15.11.12/Source/JavaScriptCore/ucd/DerivedCoreProperties.txt).
- [8: Same WebKit Yarr generator reads DICP from that UCD](https://raw.githubusercontent.com/apple-oss-distributions/WebKit/WebKit-7618.1.15.11.12/Source/JavaScriptCore/yarr/generateYarrUnicodePropertyTables.py).

Browser floors come from `apps/web/package.json`. These documented baseline versions do not pin every patch, platform build or later version admitted by `>=`. In particular, Edge's Unicode version is an explicit Chromium-based inference, not a Microsoft binary receipt. Record exact accepted build versions and compare effective property membership on engine changes. Do not infer RegExp data from fonts, emoji support, OS version or generic Unicode feature support. Browser equivalence and runtime support remain unverified.

A plain-text comparison of normative Unicode 15.0.0 and the archived 17.0.0 DICP ranges found identical sets: 4174 points, zero added/removed. WebKit's bundled file is byte-identical to Unicode's 15.0.0 file. This resolves the documented DICP-data difference between those baselines; it does not execute engines or certify all target versions. Raw files, URLs, hashes and comparison are archived in `task-503/invisible-107/unicode-docs/`. The earlier 17/18 data comparison likewise remains document evidence only.

The Node-only predicate evidence in Claude C's review and this documentation checkpoint do not replace browser acceptance or the actual schema RED/GREEN run. On upgrades, re-record engine/Unicode versions, compare the effective DICP set, and route changed membership through policy and stored-value review before delivery.

## Risks / Trade-offs

- Previously persisted DICP-only strings may exist, especially production U+3164 -> deliver .108 first, preserve its read schema, and obtain a fresh expanded-set scan/explicit compatibility decision. The .104 local scan cannot clear this expansion or production.
- Engine Unicode versions can differ -> the documented baselines above are recorded; exact accepted builds, Edge's inference and effective property support still require acceptance evidence before delivery.
- DICP characters can meaningfully affect glyphs and directionality -> reject only all-whitespace/DICP values and preserve mixed text exactly.

## Migration Plan

1. Preserve the original source/contract/test freezes before rebasing; .106's owner confirms release of the existing production classifier without changing its export/API.
2. Rebase after .108 delivery and reconcile the exact new baseline with Root. Delivery order remains .104 -> .108 -> .107.
3. Under the granted setup/focused rules, record intended baseline RED and passing controls before the smallest classifier repair and GREEN. A source change requires a refreshed source pin; first unexpected failure stops the phase. Commits need a separate fresh normal-hook window.
4. Resolve browser/Unicode acceptance and expanded persisted-value clearance separately. Run all six commands on Air003's final SHA, obtain independent review and a fresh normal-hook delivery window.
5. Any rollback is a coordinated classifier change retaining .108 read compatibility; do not delete or rewrite stored text.
