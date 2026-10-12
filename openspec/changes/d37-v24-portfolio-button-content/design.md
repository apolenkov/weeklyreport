# Design

## Context

See proposal.md. The existing native buttons already own activation, ARIA controls, disabled state and focus styling. Eight badge/body/name/status div containers are the selected content-model violation.

## Goals / Non-Goals

Use phrasing spans without changing the report content or native controls. Do not introduce role emulation, glyph semantics, focus policy or persistence changes.

## Decisions

Use span for each prior div descendant. Keep the flex badge class unchanged; add block to body/name/status containers to retain their prior display. Keep all existing button props and other layout tokens. A role=button wrapper would require new keyboard behavior and is unnecessary.

A valid shared read-model fixture flows through production mappers to the public overview render. Three normative DOM checks cover Lead, active Product and empty Product, with existing navigation/disabled controls. No class snapshot is needed.

## Risks / Trade-offs

Native browser layout, hydration and AT consequences are not proven by JSDOM. Root owns that acceptance window; these remain needs-evidence. No data-model, lifecycle, authorization or destructive-operation invariant changes. Deployment needs no migration; rollback restores the two scoped files together.
