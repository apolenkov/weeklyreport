# authenticated-product-feedback (delta, D-06/Development owner decisions)

## Purpose

Apply the owner decisions of 2026-09-24 to the durable feedback contract:
retain the authorized inbound-link inclusion guarantee (D-06a), record the
retired SitePing scroll/highlight facet without a replacement autofocus or
workbench navigation control (D-06b), and keep external Development feedback
ingress closed until a separate SSO/token specification defines it.

## MODIFIED Requirements

### Requirement: Canonical feedback context MUST survive report redirects

Canonical report redirects MUST preserve the supported legacy `feedback` and
`feedbackUrl` parameters and Agentation `agentationSession` and
`agentationAnnotation` parameters without expanding authorization scope.
This URL continuity MUST NOT introduce navigation controls in the feedback
workbench. Exact annotation autofocus is not part of the contract while the
stock widget has no supported focus API. The retired SitePing auto-scroll and
highlight behavior MUST NOT be restored, and no replacement focus mechanism is
introduced.

#### Scenario: A report route redirects to its canonical URL

- **WHEN** a URL with supported feedback context enters through a non-canonical
  lead or head report route
- **THEN** the canonical destination retains the supplied supported parameters
- **AND** ordinary feedback authorization still applies

#### Scenario: A link targets a record outside the default newest page

- **WHEN** an authorized caller follows a supported inbound feedback link
  targeting a record that is not within the default newest page
- **THEN** the initial URL-scoped list includes that record within the
  caller's existing server-derived authorization scope
- **AND** an inaccessible or missing target is not included, and its
  existence is not disclosed by a different response

## ADDED Requirements

### Requirement: External feedback ingress MUST stay closed pending a separate SSO/token specification

Only the `weekly-report` product is enabled by this contract. The reserved
`external-product` discriminator MUST NOT expose a external product ingress, and the product
MUST NOT add an external feedback-ingress route, until a separate SSO or
short-lived signed-token specification defines one.

#### Scenario: No external ingress route is exposed before its own specification

- **WHEN** the product's feedback surfaces and adapter routes are enumerated
  for any caller or product scope
- **THEN** no `external-product`-scoped or other external feedback-ingress route is
  present
- **AND** none is added by this contract before a separate SSO or short-lived
  signed-token specification defines one
