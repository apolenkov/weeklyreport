# Fix xml-crypto xmldom 0.9 mimeType compatibility

## Problem

`xml-crypto@6.1.2` calls `parseFromString(xml)` without the `mimeType`
argument in 11 places (`signed-xml.js:179,191,456,493,645,...`). On
`@xmldom/xmldom@0.9.x` (pinned by our CVE-mitigating `pnpm.overrides`
to `>=0.8.13`), `parseFromString` requires the mimeType arg and throws
`TypeError: the provided mimeType "undefined" is not valid`.

This blocks the `saml.samlify.test.ts` suite from running even after
the samlify-level patch (samlify-xmldom-onError) was applied.

## Solution

`pnpm patch xml-crypto@6.1.2` and wrap `DOMParser.parseFromString` with
a default mimeType of `'text/xml'` (same pattern used in the samlify
patch). Verify the patched library still passes its own test suite.

## Non-goals

- Replace xml-crypto with an alternative — we depend on it transitively
  via samlify AND @node-saml.
- Pin xmldom to <0.9 — reopens the XML-injection CVE.
- Upstream the fix to xml-crypto maintainers — out of scope, but worth
  filing an issue after we confirm the patch works.

## Source

The original `vitest.config.ts` marker and `saml.samlify.test.ts` describe.skip
note no longer exist — the samlify patch was completed. Re-establish a
`TODO(fix-xml-crypto-xmldom-onerror)` marker (to-be-planted, not live) at the
current XML-crypto seam when the remaining onerror gap is activated.

## Activation trigger

When the team is willing to invest in full SAML regression coverage
(both samlify AND @node-saml paths) so we can validate the xml-crypto
patch doesn't silently break production. The risk of patching a
production dependency is higher than the value of un-skipping one
test file, so this stays deferred until production SAML has e2e
coverage that would catch the regression.
