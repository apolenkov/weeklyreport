## Context

See `proposal.md` and `research.md`. The pinned SitePing widget owns contextual
draw/right-click capture but has no supported page-comment or composer movement
API. Its official payload, WeeklyReport schema, and Prisma relation already
permit zero annotations. WeeklyReport must not inspect or rewrite SitePing's
private injected DOM.

## Goals / Non-Goals

**Goals:**

- add page-level feedback through the existing authenticated boundary;
- distinguish targetless navigation from annotation focus;
- shorten the supported drawing instruction without a host positioning seam;
- keep all existing role, privacy, and lifecycle guarantees.

**Non-Goals:**

- no project-global feedback scope, upstream fork, or private composer rewrite;
- no new screenshot/diagnostic recorder for the host-owned page form;
- no persistence migration or Core Dev integration.

## Decisions

### Submit page comments through an application client

Before:

```text
SitePing composer -> POST /api/siteping -> authenticated repository
                  -> one or more SitepingAnnotation rows
```

After:

```text
Contextual: SitePing composer -> same existing path -> annotations >= 1
Page: host dialog -> typed client -> POST /api/siteping -> annotations = 0
                                      -> no SitepingAnnotation rows
```

The host dialog sends the pinned wire fields with a generated client id,
normalized pathname, selected supported type, message, viewport, user agent,
and no fabricated target. The server continues to overwrite author, product,
scope, and status. The existing endpoint is preferred over a second mutation so
dedupe, authorization, body limits, and inbox storage remain single-owned.

### Render target kind from annotations, not a new column

`annotations.length === 0` means Page feedback; a non-empty array means
Annotation. This is already representable in the official wire contract and
requires no schema change. The inbox builds a plain normalized-page link for
Page feedback and the existing focus link for Annotation.

Alternative rejected: a zero-sized body anchor. It would falsely promise marker
reattachment and couple page comments to DOM layout.

### Configure only the supported drawing instruction

Register a shorter supported locale string and leave toolbar placement, Cancel,
Escape, focus, and drawing interception to SitePing. Do not inspect injected
elements or rewrite private inline styles. Right-click remains the no-toolbar
contextual path.

## Invariants

- Period dual-state: unaffected; feedback never writes report state.
- Role-coverage gate: unaffected; the ingress remains outside tRPC and retains
  authenticated session middleware.
- Destructive DB guard: unaffected; no migration or destructive operation.

## Risks / Trade-offs

- [Page comments lack SitePing's private screenshot/diagnostic capture] -> make
  the target kind explicit and retain full capture on contextual annotations;
  do not send invented empty evidence as if captured.
- [The stock drawing toolbar can cover application chrome] -> keep the supported
  instruction short and offer right-click and page-level feedback paths; do not
  create an unowned DOM shim.
- [Annotationless records enter marker code] -> application inbox never appends
  a focus parameter for them and browser acceptance checks marker count.

## Migration Plan

No database migration is required. Deploy the server contract and inbox
handling before exposing the page-comment action. Rollback hides the host
action; existing page-feedback rows remain readable and manageable in the
inbox.
