# Design

## Context

See proposal.md for the mismatch between the declared local environment and ambient target selection. Both local dependency scripts use the same public pnpm commands; their manifests already fix namespace wr-dev. The missing context.sh path has no history in this checkout; it becomes a small live shared owner with two production callers, not revived obsolete infrastructure.

## Goals / Non-Goals

**Goals:** make the existing OrbStack target policy fail closed before mutations and keep commands pinned after admission.

**Non-Goals:** infer a cluster from context aliases, support more environments, prompt for an override or change tester-kit policies.

## Decisions

Before: ambient kubectl context → resource mutation. After: exact current-context admission → shared kubectl wrapper with explicit --context=orbstack → existing resource mutation.

A shared sourced helper avoids two diverging fences. Pinning is needed in addition to the admission check because the ambient context may change between commands. It introduces no default or fallback. Hardcoding a second namespace selector is unnecessary because existing wr-dev argv and namespaced manifests remain authoritative.

Canonical auth builders, report lifecycle tuple and destructive database guards are unchanged. The source patch opens no database connections and does not create or delete cluster resources during verification.

Tester stop before: env namespace → ambient get/delete without guard. After: shared tester_target_guard → pinned namespace resource operations. The existing tester_guard calls the same preflight before its API runtime verification. Only stop avoids the live-pod check, since a stopped stand may have no API pod. Its cancellation and existing PID cleanup behavior are preserved; raw PID ownership qualification remains separately coordinated.

## Risks / Trade-offs

- An operator with another active context must explicitly select the declared local context first → fail closed, without a new override.
- Controlled kubectl fixtures prove only source admission and argv → Root owns any native cluster identity/resource read-back and integrated gates.

## Migration Plan

Ship the shared helper with both scripts. There is no schema, configuration or data migration. Reverting the patch restores ambient target admission and reintroduces the recorded regression.
