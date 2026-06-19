# Small seed: three health colors at once

## Why

The small demo seed should show the whole health spectrum in one screen. Today it
seeds a fully-green product (Integrations, from `seed-all-green-example-product`)
plus a red and an effectively-green/at-risk mix, and the showcase-green product is
Integrations. A lead asked to reshape it so the small example demonstrates all
three product colors at once and broad stage ownership, with one stage deliberately
left vacant to show the "stage not mapped to a role" state:

- a fully GREEN product (the internal BI product) with every SDLC stage owned by
  someone EXCEPT one (Support) left vacant;
- a YELLOW product (Платформа интеграций) — at-risk, never blocked;
- a RED product (Маркетинговый портал) — blocked, including a foreign-owned blocked
  stage so the "Product context: a co-owned product red on a stage you do not own"
  scenario is preserved after BI goes green.

## What Changes

### 1. Three health colors in the small tier — CONFIRMED

The small tier MUST resolve to three distinct product health colors at once: one
green, one at-risk (yellow), one blocked (red). The green product is the internal BI
product; Платформа интеграций is at-risk; Маркетинговый портал is blocked.

### 2. BI is the green showcase with broad ownership and one vacant stage — CONFIRMED

On the green BI product every SDLC stage MUST be owned by some author (the primary
lead or a co-owner) EXCEPT exactly one stage (Support) left unowned, so the pipeline
reads as a healthy, broadly-staffed product with a single visible vacant role. The
primary lead still owns exactly two of its stages; co-owners own the rest; no risk
covers it.

### 3. The blocked demonstration moves to the red product — CONFIRMED

The blocked stage that previously sat on BI (a co-owner's DevOps blocker) MOVES to
the red Маркетинговый портал so BI can be green while the cross-author "red on a
foreign-owned stage" scenario stays demonstrated on the red product. This relocates
the existing blocked demonstration; it does not add a net-new risk to the dataset.

## Out of scope

- Reshaping the middle/huge tiers.
- Adding new risks beyond relocating the existing blocked demonstration.
- The stage-label, dialog, tooltip, and indicator changes (separate changes); this
  seed is the demonstration vehicle and lands after them.
