# Fix samlify xmldom onError deprecation

## Problem

`samlify@2.13` uses `xmldom` with the deprecated `onError` handler callback
in test setup (`saml.samlify.test.ts:142`). Modern `xmldom` no longer calls
this callback, causing silent test failures or runtime warnings.

## Solution

Either:

1. **Replace `xmldom` with `@xmldom/xmldom`** (maintained fork) — update
   `samlify` dependency or substitute `xmldom` in `package.json`.
2. **Upgrade `samlify`** to a version that uses the current `xmldom` API.
3. **Mock xmldom entirely** in test setup to avoid the deprecated API.

Recommend approach 2 (upgrade `samlify`) if a patch is available; fallback to
approach 1 (use maintained `@xmldom/xmldom`).

## Non-goals

- Rewrite SAML validation logic — focus is dependency compatibility.
- Change test coverage or assertions.

## Status

Shipped 2026-05-25 — `patches/samlify@2.13.1.patch` + comment refresh
in `apps/api/src/modules/auth/saml.samlify.test.ts` and
`apps/api/vitest.config.ts`. The samlify-level `errorHandler` →
`onError` translation and the `parseFromString` mimeType default are
in place. Test stays skipped: transitive `xml-crypto@6.1.2` still
needs its own patch — tracked in
`openspec/changes/deferred/fix-xml-crypto-xmldom-onerror/`.
