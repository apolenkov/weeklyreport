# Design

## Context

See proposal.md and external reuse-source-proof.json. Loaded/loading slide geometry and priority/legend/row author markers currently repeat identical values under one product contract.

## Goals / Non-Goals

Keep exact rendered class values, landmarks and semantics while deriving concrete consumers from one owner. No new component API, runtime state, asynchronous flow or product requirement.

## Decisions

The authorized slide-layout.ts owns four constants: responsive grid class, normal canvas class, article landmark key and author badge class. Loaded grid, normal article, loading skeleton, header priority/legend and row marks import only the constants they actually use. The activity fallback retains its different canvas class and shares only the existing landmark key.

Different author roles keep their existing markup and accessible labels; rank P badges keep their different geometry. Common geometry does not justify a common accessible-name component. Existing tests already exercise rendered skeleton geometry, header/row identity and loaded deck scoping/disclosure. Before/after controls suffice for unchanged behavior; a failing class snapshot would be an artificial RED.

## Risks / Trade-offs

Native viewport parity, layout shifts, fullscreen, Safari and AT are not established by class/DOM controls and remain needs-evidence. Dynamic callbacks, tooltip lifecycle and backend mutation errors are unchanged. This refactor touches no lifecycle tuple, authorization, destructive guard or persistence writer. No migration is required; rollback restores the six source files together.
