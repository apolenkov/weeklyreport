## MODIFIED Requirements

### Requirement: Cluster deployment is manual and gated on a supplied kubeconfig

A deploy job MAY exist only as `when: manual` on the default branch, MUST be
defined only when a file-type `KUBECONFIG` variable is set, and MUST need the
`build-images` job of the same pipeline and run in one `resource_group`. It MUST
fail before any cluster mutation unless the values file, the namespace and the
Kubernetes context (`HELM_KUBE_CONTEXT`) are supplied by CI variables, and it MUST
pass the context and namespace to every Helm call. It MUST discover the release
`weeklyreport` in that context and namespace. Absence MUST be confirmed by Helm's
own release-not-found error from the release history (an empty release list is
not enough, because the list omits records in an unknown state and records Helm
cannot decode); only then is the release installed with
`helm install --wait=watcher`. A release whose history is readable and which is in
the `deployed` state is upgraded with `helm upgrade --wait=watcher` and without
`--install`. A history error (access, network, Helm), a successful history with no readable
revision, an inconsistent or unexpected answer, or any other release state MUST
stop the job without installing or upgrading. The job MUST NOT use `--atomic` or
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

- **WHEN** the history lookup fails, answers inconsistently with the release list, shows a release that is not `deployed`, or succeeds without a readable revision although release records exist
- **THEN** the job stops without installing or upgrading

#### Scenario: Only release-not-found proves absence

- **WHEN** the history lookup fails with anything other than Helm's release-not-found error, or succeeds without a revision
- **THEN** the job does not treat an empty release list as an absent release
