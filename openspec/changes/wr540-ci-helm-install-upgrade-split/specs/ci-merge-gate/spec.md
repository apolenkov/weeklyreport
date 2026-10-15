## MODIFIED Requirements

### Requirement: Cluster deployment is manual and gated on a supplied kubeconfig

A deploy job MAY exist only as `when: manual` on the default branch, MUST be
defined only when a file-type `KUBECONFIG` variable is set, and MUST need the
`build-images` job of the same pipeline and run in one `resource_group`. It MUST
fail before any cluster mutation unless the values file, the namespace and the
Kubernetes context (`HELM_KUBE_CONTEXT`) are supplied by CI variables, and it MUST
pass the context and namespace to every Helm call. It MUST discover the release
`weeklyreport` in that context and namespace: an absent release is installed with
`helm install --wait=watcher`; a release in the `deployed` state is upgraded with
`helm upgrade --wait=watcher` and without `--install`. A discovery error, an
inconsistent or unexpected discovery answer, or any other release state MUST stop
the job without installing or upgrading. The job MUST NOT use `--atomic` or
`--rollback-on-failure`, MUST NOT uninstall or delete a release, and MUST NOT
create the namespace. The repository MUST NOT contain cluster credentials, and
MUST NOT assume Argo CD.

#### Scenario: No kubeconfig supplied

- **WHEN** `KUBECONFIG` is not set
- **THEN** the pipeline contains no deploy job

#### Scenario: Required target variable missing

- **WHEN** the deploy job starts without `HELM_KUBE_CONTEXT`, `HELM_NAMESPACE` or `HELM_VALUES_FILE`
- **THEN** it fails with a message naming the variable before any Helm call

#### Scenario: First install

- **WHEN** release discovery succeeds and finds no `weeklyreport` release
- **THEN** the job runs `helm install` with `--wait=watcher` and the commit-SHA image tag
- **AND** a failed install keeps the release, its resources and volume claims for diagnosis

#### Scenario: Upgrade of an existing release

- **WHEN** discovery shows `weeklyreport` in the `deployed` state
- **THEN** the job runs `helm upgrade --wait=watcher` without `--install` and without automatic rollback

#### Scenario: Discovery cannot be trusted

- **WHEN** release discovery fails, answers inconsistently, or shows a release that is not `deployed`
- **THEN** the job stops without installing or upgrading
