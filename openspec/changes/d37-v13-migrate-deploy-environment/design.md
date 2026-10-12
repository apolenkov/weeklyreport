# Design

## Context

The current migration wrapper guards the injected input, then builds a different inherited environment for spawnSync. Its ordinary CLI passes a full process snapshot, but the exported operation admits partial inputs. See proposal.md and the existing destructive-db-guard contract.

Before: supplied environment → guard → separately merged child environment → spawn.
After: supplied safety inputs + inherited runtime environment → one resolved snapshot → guard → spawn with that snapshot.
The exact disposable target/consent and production-denial invariants are preserved; period lifecycle and role-coverage boundaries are untouched.

## Goals / Non-Goals

**Goals:** close the validation/execution mismatch while preserving explicit safety inputs and existing command behavior.

**Non-Goals:** new guard APIs, diagnostics, native operations or dependency changes.

## Decisions

Create one child environment before the guard. Inherit runtime variables as before and apply explicit overrides. Anchor DATABASE_URL and per-run consent to the injected input: absent values previously failed before spawn, so blindly validating a merge would accidentally admit previously refused requests. Validate and pass this same resolved snapshot. Do not drop inherited PATH/runtime variables or add a second divergent guard object.

## Risks / Trade-offs

- A simple unrestricted merge could permit omitted safety fields from ambient state → existing-behavior controls require explicit target and consent.
- An injected spawn proves the wrapper boundary but does not execute Prisma or PostgreSQL → describe proof as pure admitted guard/child-boundary execution; Root owns any separately required native phase and aggregate acceptance.

## Migration Plan

No data/schema migration. Root delivers the isolated source/test/spec patch with normal hooks. Aggregate gates/review and OpenSpec sync/archive remain with Root.
