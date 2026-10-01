## 0. Prerequisites (no code)

- [ ] 0.1 Send the DevOps letter (open questions in the delivery report) and
      record the answers in the backlog. Tasks 5, 6, and 8 depend on questions
      1 (runner privileges), 2 (registry), and the Ingress/CNI facts.
      Acceptance: each question has an answer or an explicit assumption in `docs/kubernetes.md`.

## 1. Chart skeleton and fail-closed configuration

- [ ] 1.1 Create `deploy/helm/weeklyreport/` (`Chart.yaml`, `.helmignore`,
      `values.yaml`, `values.schema.json`, `values.production.example.yaml`,
      `templates/`), and add `deploy/helm/weeklyreport/templates/` to
      `.prettierignore` and `deploy/helm` to `.dockerignore`.
      Acceptance: `helm lint` passes with the fixture values; `pnpm format:check` passes.
- [ ] 1.2 Schema marks every compose `${VAR:?}` input required, pattern for
      `postgres.db`, `additionalProperties: false`; `secrets.existingSecret` xor
      `secrets.create`; template `fail` for password character set.
      Acceptance: negative-render tests (drop each required key; both/neither secret
      source; password with `@`) all fail with the key named.
- [ ] 1.3 Add the chart gate test in `scripts/gates/operations/` (spawns `helm`,
      `kubeconform`): lint, render, kubeconform, negative renders, CHROMIUM
      invariants, literals `AUTH_DEV_MODE=false` and `NODE_ENV=production`, no
      secret value in any ConfigMap, no `latest`.
      Acceptance: test passes; relaxing `CHROMIUM_MAX_CONCURRENCY` in the template makes it fail.

## 2. Edge and Caddyfile

- [ ] 2.1 `git mv deploy/caddy/Caddyfile deploy/helm/weeklyreport/files/Caddyfile`;
      update compose mount, `deploy/caddy/README.md`, docs, specs, and test path
      references; run `pnpm lint` (cleanliness, knip) to prove no stale path.
      Acceptance: `git grep "deploy/caddy/Caddyfile"` returns only history-free
      documentation that names the new path.
- [ ] 2.2 Add `trusted_proxies` from `CADDY_TRUSTED_PROXIES` and
      `header_up X-Forwarded-For {client_ip}`; chart mode uses `http://:8080` and
      `auto_https off`. Decide the `email` global for chart mode.
      Acceptance: `caddy validate` passes for the compose and chart environments
      (run in a throwaway container, light); compose rendering test still passes.
- [ ] 2.3 Edge Deployment, Service `edge`, ConfigMap from `.Files`, emptyDir
      volumes, exec probe, Ingress with `className`, host, TLS secret, annotations
      as values.
      Acceptance: render test asserts one Ingress rule to `edge` and no other
      Service is referenced by any Ingress.

## 3. Core workloads

- [ ] 3.1 postgres StatefulSet (PGDATA subdirectory, fsGroup, probe), pgbouncer,
      redis StatefulSet (one `maxmemoryMb` value feeds flag and
      `REDIS_MAXMEMORY_BYTES`).
      Acceptance: render test compares image digests with compose; `redis` flag
      and env value derive from the same number.
- [ ] 3.2 api Deployment (`Recreate`, one replica, `pdfdata` PVC, probes live/ready/startup,
      20s grace), initContainers `config-guard` then `migrate`, ConfigMap/Secret env, `DATABASE_URL`
      by `$(DB_PASSWORD)` expansion, optional scrape annotations; web Deployment;
      gotenberg Deployment with fixed `CHROMIUM_*` and `PDF_BASE_URL`/allow-list from
      one template variable.
      Acceptance: parity test (compose api/web/gotenberg env keys versus chart) passes
      with a reviewed exception list; allow-list equals the escaped `PDF_BASE_URL` origin.
- [ ] 3.3 NetworkPolicies (default deny ingress; edge to web/api, web to api,
      api to pgbouncer/redis/gotenberg/postgres, pgbouncer to postgres,
      backup to postgres, monitoring namespace to api; gotenberg egress to web
      and DNS only), behind `networkPolicy.enabled`.
      Acceptance: render test; enforcement itself is NOT VERIFIED locally unless the CNI enforces.
- [ ] 3.4 Security contexts and resources per design section 4.
      Acceptance: render test asserts the fields on every pod; read-only root
      filesystem only where task 8 verified it.

## 4. Backup

- [ ] 4.1 Add `BACKUP_RUN_ONCE` mode to `deploy/postgres/backup-loop.sh` (interval
      not required in that mode, exit status of the dump) and cases in
      `scripts/gates/operations/backup-loop.test.ts`; keep loop mode byte-identical in behaviour.
      Acceptance: `pnpm test` backup tests pass, including failed-dump non-zero exit and no leftover `.partial`.
- [ ] 4.2 CronJob (`Forbid`, required schedule and retention, history 3/3,
      `pgbackups` PVC) and restore instructions.
      Acceptance: render test; chart carries no off-cluster claim.

## 5. CI image build

- [ ] 5.1 Manual probe job `build-probe` with the pinned
      `moby/buildkit:v0.33.1-rootless@sha256:...` (re-read the digest): run
      `buildctl-daemonless.sh --help` and one trivial build on `cp-test-runner`.
      Acceptance: output recorded; the result decides question 1 to DevOps and
      the fallback order in design.md section 7.
- [ ] 5.2 `build-images` job per the requirement (variables, fail-closed guard,
      branch/tag/MR rules, SHA tags, digest artifact, `resource_group`).
      Acceptance: a job with `IMAGE_REGISTRY` unset fails at its first line and
      starts no build; `.gitlab-ci.yml` still passes `lint:runtime-node`.
- [ ] 5.3 Update `prod-compose-gate.test.ts` (negative lock to "image build only
      in the gated job", reviewed external-image set, Caddyfile path),
      `docs/gitlab-ci.md`, `docs/operations.md` CI section.
      Acceptance: `pnpm test` passes; the old negative lock still rejects a
      Docker-in-Docker lane.
- [ ] 5.4 `quality` job: pinned sha256 `helm` and `kubeconform` downloads like the
      existing `docker-compose` step, so chart tests run in CI.
      Acceptance: pipeline log shows both versions and the chart test passing.

## 6. CD

- [ ] 6.1 Optional `deploy-production` job (manual, default branch, defined only
      with `KUBECONFIG`, pinned helm image, `--atomic --wait --timeout 10m`).
      Acceptance: the job is absent from a pipeline without `KUBECONFIG`
      (check with `gitlab-ci-lint` or a rules test); no credential in the repo.
- [ ] 6.2 `docs/kubernetes.md`: install, upgrade, rollback limits (database not
      rolled back), secret keys and rotation, restore drill, one release per
      namespace, what monitoring needs, assumptions about DevOps answers.
      Add it to `docs/README.md`; update `docs/operations.md` rollback and
      prerequisite sections to say the image-source blocker is closed only after a
      first push, not before.
      Acceptance: `grep` for stale statements ("no image-tag input", "CI carries only") finds none.

## 7. Specs

- [ ] 7.1 Sync the change into `openspec/specs/` at archive time, add the
      `deploy-kubernetes-chart` line to `openspec/specs/README.md`, and keep
      `openspec/changes/archive/` empty afterwards (cleanliness gate).
      Acceptance: `pnpm spec:check` and `pnpm lint:cleanliness` pass.

## 8. Local acceptance on OrbStack (separate session, after 1 to 4)

- [ ] 8.1 Preflight: memory headroom, `kubectl config current-context` is
      `orbstack`, namespace `wr-k8s-accept` absent; install `kubeconform`.
      Build `api`, `migrate`, `web`, `backup` one at a time with Docker (no
      registry). Acceptance: four images present; peak memory noted.
- [ ] 8.2 `helm install` with a scratch values file kept outside the repository.
      Verify every item of design.md section 8 step 4 and record command output.
      Resolve the two decisions it names: the private-IP/allow-list risk and the
      read-only root filesystem per workload.
      Acceptance: each item is PASS with output, or NOT VERIFIED with a reason.
- [ ] 8.3 Delete the namespace and local images; confirm no stray processes,
      port-forwards, or files in the worktree.
      Acceptance: `kubectl get ns` shows it gone; `git status` clean apart from task files.

## 9. Gates before "done"

- [ ] 9.1 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
      `pnpm spec:check`, `openspec validate deploy-kubernetes-helm --strict`
      all green, results quoted (a gate not run is not passed).
- [ ] 9.2 Independent review of the final SHA by another model, then green CI on
      that SHA (owner rule); merge only after both.

## Non-goals recorded

- Deleting `docker-compose.prod.yml`, HA PostgreSQL, Argo CD, SBOM/provenance, off-cluster
  backup replication, second environment image tags, HPA/multi-replica api.
