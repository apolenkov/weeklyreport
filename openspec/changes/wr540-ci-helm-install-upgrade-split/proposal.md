# wr540: split first Helm install from upgrade in `deploy-production`

## Why

`deploy-production` always ran `helm upgrade --install --atomic`. On a first
install `--atomic` is rollback-on-failure, which is an uninstall: it can delete
the Helm-managed `pdfdata`/`pgbackups` claims and, with a Delete reclaim policy,
their volumes. That contradicts the accepted deployment procedure (first install
preserves the failed release; upgrade is a separate, compatibility-gated
branch). Production roll-out will go through this job.

## What changes

- The job discovers the release in the exact configured Kubernetes context and
  namespace. Absence is proven only by Helm's release-not-found error from
  `helm history` (the storage driver returns it when no release record exists);
  `helm list` alone is not trusted, because it omits unknown-state records and
  skips records it cannot decode. Absent → `helm install --wait=watcher`;
  readable and deployed → `helm upgrade --wait=watcher` (no `--install`);
  a history error, a successful history with no readable revision, an
  inconsistent answer or any other release state → stop before a mutation.
- No automatic rollback or uninstall in CI: install keeps a failed release and its
  resources; an upgrade is forward-fix because CI cannot prove schema and data
  compatibility. `helm rollback` stays a manual runbook step.
- New required variable `HELM_KUBE_CONTEXT`, passed as `--kube-context` to every
  Helm call. Manual GO, `needs: build-images`, `resource_group`, the pinned image
  and secret handling are unchanged.

## Non-goals

No chart or PVC retention change, no tester-kit change, no `--create-namespace`
(a missing namespace stops the install before anything is created), no new
operator flag besides `HELM_KUBE_CONTEXT`. `docs/operations.md` and
`docs/kubernetes.md` are owned by TASK-471 and receive the same wording by hand-off.

## Verification

`scripts/gates/operations/deploy-production.test.ts` runs the job script against a
stub `helm`. A real failed first install on a fresh, empty, owned namespace is a
separately granted check (release, PVC UIDs and logs preserved).
