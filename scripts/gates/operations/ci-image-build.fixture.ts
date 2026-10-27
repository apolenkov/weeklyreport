// Shared fixtures for the buildah image-build contract: the internal registry
// and mirror pins, the fail-closed web build inputs and the buildah CLI stub.

// The internal Docker Hub mirror every external base image is rewritten to.
export const BASE_REGISTRY = "mirror.example.org/all-pub-docker";
// buildah 1.43.5: the version the new runner was probed with.
export const BUILDAH_IMAGE = `${BASE_REGISTRY}/buildah/stable:v1.43.5@sha256:87f219f5a7bf5d7bee870253c14a57751e85833cb2cc645216a20bbb66c68724`;

const fixtureToken = "job-token-fixture";

export const robotToken = "robot-fixture";
export const commitSha = "0123456789abcdef";

export const BUILD_ENV = {
  CI_COMMIT_SHA: commitSha,
  CI_REGISTRY_IMAGE: "registry.example.com/group/project",
  CI_REGISTRY_USER: "gitlab-ci-token",
  CI_REGISTRY_PASSWORD: fixtureToken,
  BASE_REGISTRY,
  WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING: "false",
  WR_NEXT_PUBLIC_WEB_VITALS: "false",
  WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED: "false",
  WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES: "admin",
} as const;

// Stands in for the buildah CLI: records the invocation, captures the mirrored
// Dockerfile passed to `bud`, drains the password from `login`, and answers
// `push --digestfile` with a deterministic digest.
export const BUILDAH_STUB = String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$STUB_CALLS"
command="$1"
shift
case "$command" in
  login)
    while IFS= read -r ignore; do :; done
    ;;
  bud)
    [ -e "$CI_PROJECT_DIR/image-digests.txt" ] && printf 'present\n' >> "$STUB_CONTEXT_LEAKS"
    previous=""
    for argument in "$@"; do
      [ "$previous" = "-f" ] && cp "$argument" "$STUB_FILES/$(basename "$argument")"
      previous="$argument"
    done
    ;;
  push)
    previous=""
    for argument in "$@"; do
      [ "$previous" = "--digestfile" ] && printf 'sha256:%064d\n' 1 > "$argument"
      previous="$argument"
    done
    ;;
esac
exit 0
`;

// Repository Dockerfiles the job builds, relative to the project root.
export const DOCKERFILES = [
  "Dockerfile.api",
  "Dockerfile.web",
  "deploy/postgres/Dockerfile.backup",
] as const;
