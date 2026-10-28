# Design

## Context

See `proposal.md` and `specs/pdf-renderer-service/spec.md`. The baseline contract specifies 8.37.0, while the checked-in Helm, local-development, and image-policy test references use 8.38.1. The current worktree is based on lucide commit `640c1313ce7210a24efe8c73a21b76cd60d53035`, which has not yet been delivered; the coordinator owns its delivery and any integration decision.

The observed `8.39.0-chromium` manifest-list digest at 2026-10-28 08:13–08:21 UTC was `sha256:558943677cf9092df83ff654c2645856dcb9ddf777f359243789688e74f3bcdd`, with Docker Hub `tag_last_pushed` at 2026-10-27 08:13:07.752209 UTC. This is an observation, not a substitute for rechecking the tag, its age, and `crane digest`/`crane manifest` before apply.

## Goals / Non-Goals

**Goals:**

- Align the exact renderer requirement, both deploy pins, and the reviewed-image set to one release and one verified multi-platform digest.
- Keep the existing PDF and security contracts and establish evidence for the new renderer on the actual delivered tree.

**Non-Goals:**

- Change HTTP request fields, PDF export semantics, service exposure, network policy, or unrelated dependency pins.
- Use planning as authority to run the application, mutate a database, publish an image, or deliver the parent commit.

## Decisions

1. **One exact tag and the registry's manifest-list digest.** Use `gotenberg/gotenberg:8.39.0-chromium` in the delta; on apply use the same freshly checked tag and digest in both deployment manifests and `REVIEWED_EXTERNAL_IMAGES`. A mutable tag alone or a platform-specific digest would not satisfy the existing immutable multi-platform contract. Generalizing the requirement to an arbitrary version or retaining the stale 8.37.0 text would not satisfy the coordinator's requested reconciliation.
2. **Keep the full existing requirement.** The delta reproduces both scenarios and all clauses for an internal-only service, no host port or public ingress, API-only reachability, and validated fail-closed `GOTENBERG_URL`; only the version text changes. No other PDF requirement is modified.
3. **Validate the unchanged PDF path with the new image.** The flow remains `published snapshot → export job → authenticated print URL → POST /forms/chromium/convert/url → validated PDF → authorized artifact`, both before and after this slice. Static checks cannot establish the new Chromium's rendering or network behavior. A live PDF proof and six gates are separate coordinated steps on the reviewed tree; their results are not inferred from this plan.

The report period dual-state, role-coverage authorization and destructive-database guard are neither changed nor relaxed. No schema migration or feature flag is planned. The API and web remain consumers of the same print URL, token, snapshot and artifact contracts.

## Risks / Trade-offs

- **Upstream security and Chromium changes** → The [8.39.0 release notes](https://github.com/gotenberg/gotenberg/releases/tag/v8.39.0) restrict URL routes to HTTP(S), apply deny rules to WebSocket handshakes, remove compromised CA roots, harden ExifTool metadata handling, and update Chromium to 156. The adapter already rejects non-HTTP(S) print URLs, but this source observation does not prove rendering, font loading, certificate chains, resource fetches, or failure statuses with the new image. Exercise those paths in the separately coordinated live PDF proof; do not weaken the network policy to make it pass.
- **A mutable tag or a changed upstream digest** → Repeat the official registry, 24-hour age, `crane digest`, and manifest-list checks immediately before apply. Stop on an unknown digest, insufficient age, a changed parent, or a release requiring new PDF semantics; do not silently substitute a platform digest.
- **Shared resources and implicit pnpm install** → Before any future lightweight check, verify load <20 and available memory ≥8 GiB. If any command or hook can install dependencies, acquire `/home/user/.local/state/coordinator/prepush.lock`, recheck both limits after acquisition, and release without installing if they fail. Do not modify another worktree's dependencies.
- **Dependency on the undelivered parent** → Keep the recorded base; if the parent changes, report to the coordinator instead of rebasing or pushing independently.

## Migration Plan

After a new apply assignment, update the three image references and, at the appropriate OpenSpec sync/archive step, align the durable specification with the delta. The coordinator schedules independent review, the six exact-tree gates, and the live PDF proof with the owner of the shared test environment. No database migration is required. If a rollback is needed, coordinate it as a separately reviewed change that aligns the chosen previously reviewed image and its specification; reverting only the image pins would recreate contract drift.
