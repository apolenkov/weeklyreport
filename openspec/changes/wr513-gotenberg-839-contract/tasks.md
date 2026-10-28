# Tasks

> For the future native executor: after a new coordinator assignment to apply this change, use `superpowers:executing-plans`; this plan alone does not authorize apply.

**Goal:** Align the Gotenberg image and its exact PDF renderer contract at 8.39.0 while preserving PDF behavior.

**Architecture:** Keep the current renderer service and request path. Change the exact spec tag and the three image references as one verifiable slice; bind later independent review, live PDF evidence, and repository gates to the reviewed tree.

**Tech Stack:** OpenSpec, Helm, Kubernetes manifests, Gotenberg Chromium, Vitest, pnpm.

**Spec:** `openspec/changes/wr513-gotenberg-839-contract/specs/pdf-renderer-service/spec.md`; preserve the other requirements in `openspec/specs/pdf-renderer-service/spec.md` and `openspec/specs/pdf-export-integrity/spec.md`.

## Global Constraints

- Start from `640c1313ce7210a24efe8c73a21b76cd60d53035`; its delivery is a coordinator dependency. If it changes, report and stop; do not rebase or push independently.
- The exact tag is `gotenberg/gotenberg:8.39.0-chromium`; the pinned sha256 is the freshly verified multi-platform manifest-list digest, never a platform digest. A tag less than 24 hours old or an unknown digest is a stop condition.
- Preserve the internal-only ClusterIP service, no host port/host networking or public ingress, API-only reachability, and fail-closed `GOTENBERG_URL`. Do not change PDF semantics, renderer security policy, unrelated dependencies, or lockfile.
- For lightweight checks use load <20 and available memory ≥8 GiB. If a command or hook may install, acquire `/home/user/.local/state/coordinator/prepush.lock`, recheck the limits after acquisition, and release without installing if they fail. Do not run a test whose isolation is unknown.
- Live PDF, six full gates, and independent review require their separately coordinated assignments; no publishing is authorized by this plan.

## Review Focus

1. A rebuilt or too-young tag must not be accepted — verify the registry age and manifest in 1.1.
2. A platform-specific digest must not replace the manifest-list digest — verify the manifest media type and all three pins in 1.1–1.3.
3. A public renderer or absent/malformed `GOTENBERG_URL` must still fail the relevant contract — check the Helm and environment tests in 1.5.
4. A denied origin or affected certificate chain must not silently produce a successful export — exercise the actual renderer in 2.2.
5. A not-ready page or the wrong requester/snapshot must not produce an accepted PDF — check the API boundary in 1.5 and the live proof in 2.2.

## 1. Renderer release slice

- [x] 1.1 After a new apply assignment, record the branch/HEAD/tree and compare the parent with `640c1313ce7210a24efe8c73a21b76cd60d53035`; query the official latest release and Docker Hub `8.39.0-chromium` timestamp, run `crane digest gotenberg/gotenberg:8.39.0-chromium` and `crane manifest gotenberg/gotenberg:8.39.0-chromium`, and record time, ≥24-hour age, matching index digest and manifest-list media type. Stop and report if 8.39.0 is no longer the stable latest, on any mismatch or unknown, if the parent changes, or if the release needs new product semantics.
- [x] 1.2 In `scripts/gates/operations/deployment-images.test.ts`, replace the old reviewed Gotenberg entry with the exact freshly verified 8.39.0 tag and index digest. After confirming isolation and resource admission, run `pnpm exec vitest run --testTimeout=30000 scripts/gates/operations/deployment-images.test.ts`; verify that the image-policy test fails because the two deployment references still use the old pin, and record the exit and reason.
- [x] 1.3 Update `deploy/helm/weeklyreport/values.yaml` and `deploy/local-dev/deps.yaml` to the same exact tag and digest as the reviewed-image entry. Re-run the 1.2 test and require exit 0; inventory tracked Gotenberg image references to confirm no old deployment or test pin remains and no unrelated dependency changed.
- [x] 1.4 Follow the OpenSpec sync workflow to apply the delta to `openspec/specs/pdf-renderer-service/spec.md`; verify that the main requirement and both scenarios differ from the baseline only by `8.37.0-chromium` → `8.39.0-chromium`, and validate the affected change and spec. Do not modify other PDF requirements.
- [x] 1.5 After rechecking admission and isolation, run the commands below from the worktree root. Require exit 0 for every launched check, verify the internal-only and fail-closed scenarios, and record NOT RUN for any test whose isolation is unproven. Honor the lock rule above before any command that may install.

  ```sh
  pnpm exec prettier --check deploy/helm/weeklyreport/values.yaml deploy/local-dev/deps.yaml scripts/gates/operations/deployment-images.test.ts openspec/specs/pdf-renderer-service/spec.md openspec/changes/wr513-gotenberg-839-contract
  pnpm exec vitest run --testTimeout=30000 scripts/gates/operations/deployment-images.test.ts scripts/gates/operations/helm-chart.test.ts scripts/gates/operations/helm-production-contract.test.ts scripts/gates/operations/local-dev-contract.test.ts
  pnpm --filter @weeklyreport/api exec vitest run src/infrastructure/config/env.schema.test.ts src/modules/pdf-export/gotenberg-pdf-renderer.adapter.test.ts src/modules/pdf-export/pdf-export.service.test.ts src/modules/pdf-export/pdf-export.contract.test.ts
  ```

- [x] 1.6 Review `git diff --check`, changed paths and the exact main-spec delta; verify and record that the diff is ready for a Conventional Commit.

After 1.1–1.6 are complete and their checkboxes are marked, make the authorized Conventional Commit using normal hooks, without bypass, and record its parent, commit SHA and tree SHA. If a hook may install, use the lock and post-lock resource checks above; preserve the work and report a blocked hook instead of skipping it.

## 2. Coordinated acceptance

- [x] 2.1 Obtain independent native review of the exact candidate and record reviewer, verdict and SHA; address findings in the same scope and rebind evidence if the tree changes.
- [x] 2.2 In a separately assigned window with the shared-environment owner, perform the live PDF proof using the verified image: a published snapshot and authorized requester produce the correct A4 PDF after the ready marker and fonts load; verify PDF header/trailer, scoped cookies, allowed print origin, forbidden outbound destination, relevant certificate/resource behavior and unchanged failure classification. Record the exact image digest, target, commands, cleanup and results; an unknown or failed observation is not PASS. Live proof completed on stand C (lane A DB weeklyreport_e2e_lane_a_test, Redis DB 1, API port 3042, web port 3040, Gotenberg 8.39.0 probe on 3044; see evidence in ~/work/handoffs/wr-513/s26/b2/513-gotenberg-live-RESULT.md).
- [x] 2.3 In a separate authorized gate window, run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm spec:check` on the final reviewed delivery tree; record each exact command, exit and log with commit/tree SHA. After checks have actually passed, record completed tasks and coordinate OpenSpec archival. If task-status or archive edits change the reviewed tree, bind independent review and all six gates again to the final delivery tree; do not mark an unrun check as passed. After independent review and green gates, the coordinator may push to main under the existing brief; this executor does not push or publish images.
