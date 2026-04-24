---
phase: 19-documentation
type: context
---

# Phase 19 Context — Documentation

## Purpose

Finalize all project documentation for handoff: API reference, deployment
guide, developer onboarding, and user guide. Existing docs (MANIFEST.md,
DESIGN.md, REGRESSION-SCENARIOS.md) are already comprehensive — this phase
fills the remaining gaps.

## Dependencies

- Phase 17 complete (all features implemented)
- Phase 18 complete (E2E tests passing — validates documented behavior)

## Existing Documentation (DO NOT rewrite)

- ✅ `MANIFEST.md` — design decisions D-1..D-70
- ✅ `DESIGN.md` — Starbucks design system
- ✅ `REGRESSION-SCENARIOS.md` — 223 test scenarios
- ✅ `.planning/REQUIREMENTS.md` — traceability matrix
- ✅ `.planning/ROADMAP.md` — milestone/phase breakdown
- ✅ `CLAUDE.md` — tech stack, architecture decisions

## Gaps to Fill

1. **API Reference** — document all tRPC endpoints with input/output shapes
2. **Deployment Guide** — Docker Compose prod setup, env vars, health checks
3. **Developer Onboarding** — local setup steps, dev workflow, common tasks
4. **User Guide** — role-based workflows with screenshots
