## Why

WeeklyReport lacks a contextual product-feedback channel tied to authenticated users. SitePing supplies the annotation wire format and inbox primitives, but its stock identity fields are browser-controlled and its default read/auth model does not satisfy WeeklyReport's session, group, or role rules.

## What Changes

- Pin `@siteping/adapter-prisma@0.6.4` behind one authenticated feedback module; add compatible widget/dashboard packages only where consumed.
- Persist an immutable server-derived `authorUserId` plus display snapshots, product, group scope, page, status, message, and DOM annotations.
- Expose a same-origin `/api/siteping` ingress that resolves the existing human session, ignores client identity/product claims, and applies method-specific authorization.
- Allow every active authenticated user to create, list, triage, and delete their own feedback; allow `head` to triage group feedback and `admin` to manage all feedback.
- Ship WeeklyReport with SitePing's complete standard collection surface for every authenticated role: drawn annotations, right-click comments, screenshots, console/network diagnostics, markers, sidebar, and deep links. Reserve `external-product` as a product discriminator but do not enable it before a separate SSO or signed-token ingress.
- Harden SitePing retry, concurrent idempotency, deep links beyond the first page, canonical redirects, and DOM anchors without forking its standard sidebar.
- Add an authenticated inbox surface and browser acceptance for creation, ownership, triage, and denial paths.

### Non-goals

- No anonymous feedback, browser API key, public SitePing handler, cross-origin external product ingress, webhooks, automatic issue creation, or SitePing capabilities fork.
- No replacement of report comments/review verdicts or onUI developer annotations.
- No destructive database operation outside the explicit disposable guard.

## Capabilities

### New Capabilities

- `authenticated-product-feedback`: contextual feedback with server-authoritative identity, product/group scope, role-aware triage, and SitePing-compatible transport.

### Modified Capabilities

None.

## Impact

- API: new deep feedback module, authenticated raw ingress, Prisma models, tests, metrics/audit integration.
- Web: SitePing widget and scoped inbox route, English UI strings, environment flag.
- Data: additive Prisma schema/init-migration changes, including bounded inline screenshot and diagnostic fields; explicit disposable recreation proof required.
- Dependencies: pinned SitePing adapter/widget/dashboard packages.
