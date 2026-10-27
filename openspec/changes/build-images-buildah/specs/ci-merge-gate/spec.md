## MODIFIED Requirements

### Requirement: The image-build job fails closed and uses no Docker daemon

The image-build job MUST build with buildah pinned by `tag@sha256:` digest from
the internal mirror, without Docker-in-Docker, a mounted Docker socket or
privileged job capabilities, and MUST run with the vfs storage driver and chroot
isolation. It MUST pull every external base image through the internal Docker Hub
mirror by rewriting the repository Dockerfiles' `FROM` references into a
job-local copy, and MUST fail before building, naming it, when an external base
image is not mirrored. The repository Dockerfiles MUST keep their upstream `tag@sha256:`
references. Built and pushed images MUST use the Docker v2 manifest format so
`HEALTHCHECK` survives. It MUST push to the registry named by `IMAGE_REGISTRY`
when set, otherwise to `$CI_REGISTRY_IMAGE`, with `IMAGE_REGISTRY_USER` and
`IMAGE_REGISTRY_PASSWORD` when set, otherwise the job token credentials, and
MUST fail before building when the resolved registry, user, or password is empty,
or any `WR_NEXT_PUBLIC_*` value `Dockerfile.web` requires is unset. It MUST keep
registry credentials in a job-local auth file outside `$CI_PROJECT_DIR` and never
print them. It MUST use no keyword newer than the instance's GitLab version
(15.10). It MUST run automatically on default-branch push pipelines once the web
build variables are configured, be manual and non-blocking before that, and be
manual and non-blocking on merge requests. It MUST tag each pushed image with the
commit SHA and publish the resulting digests as a job artifact.

#### Scenario: Registry variables are missing

- **WHEN** the job runs with neither `IMAGE_REGISTRY` nor `$CI_REGISTRY_IMAGE` available, or a required `WR_NEXT_PUBLIC_*` value unset
- **THEN** it fails in its first script step with a message naming the variable
- **AND** no build starts

#### Scenario: Merge request pipeline

- **WHEN** a merge-request pipeline is created
- **THEN** the image-build job is manual and its absence of a run does not fail the pipeline

#### Scenario: Images are built from the pinned toolchain

- **WHEN** the job runs
- **THEN** it builds `api`, `migrate`, `web`, and `backup` from the repository Dockerfiles through the internal mirror with buildah and no Docker daemon
- **AND** the job image is a digest-pinned buildah image listed in the reviewed external-image set
- **AND** each image is tagged with the commit SHA and its digest is recorded in `image-digests.txt`
