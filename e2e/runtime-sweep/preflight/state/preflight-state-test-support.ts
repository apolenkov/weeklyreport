import { rm } from "node:fs/promises";

import { buildCampaignSource } from "../../manifest/manifest.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../../manifest/manifest-fixture.ts";
import type { MatrixAxes } from "../../source/contracts-types.ts";
import { sha256Hex } from "../../support/ids.ts";
import type { PreflightAssignment } from "../artifacts/preflight-assignment.ts";
import {
  createPreflightSegmentArtifact,
  type PreflightSegmentArtifact,
} from "../journal/preflight-journal-artifact.ts";
import { preflightJournalStateDigest } from "../journal/preflight-journal-contract.ts";
import type { PreflightStateSelector } from "./preflight-state.ts";

export type CampaignSource = Awaited<ReturnType<typeof buildCampaignSource>>;
export type AxisMutation = readonly [string, (axes: MatrixAxes) => MatrixAxes];

export const withSource = async <T>(
  callback: (source: CampaignSource) => Promise<T> | T,
): Promise<T> => {
  const fixture = await createManifestFixture();
  try {
    return await callback(
      await buildCampaignSource(fixture.input, fakeManifestGit()),
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
};

export const canonicalAxisMutations: readonly AxisMutation[] = [
  [
    "role",
    (axes) => ({
      ...axes,
      role: axes.role === "lead" ? "head" : "lead",
    }),
  ],
  [
    "route",
    (axes) => ({
      ...axes,
      route: axes.route === "lead:/lead" ? "head:/head" : "lead:/lead",
    }),
  ],
  [
    "profileCapability",
    (axes) => ({
      ...axes,
      profileCapability:
        axes.profileCapability === "canonical-identities"
          ? "editable-active-report"
          : "canonical-identities",
    }),
  ],
  [
    "lifecycle",
    (axes) => ({
      ...axes,
      lifecycle: axes.lifecycle === "open" ? "published" : "open",
    }),
  ],
  [
    "submission",
    (axes) => ({
      ...axes,
      submission: axes.submission === "draft" ? "submitted" : "draft",
    }),
  ],
  [
    "ownershipDensity",
    (axes) => ({
      ...axes,
      ownershipDensity:
        axes.ownershipDensity === "single" ? "multiple" : "single",
    }),
  ],
  [
    "permission",
    (axes) => ({
      ...axes,
      permission: axes.permission === "allowed" ? "forbidden" : "allowed",
    }),
  ],
  [
    "fault",
    (axes) => ({
      ...axes,
      fault: axes.fault === "none" ? "api-error" : "none",
    }),
  ],
  [
    "controlTransition",
    (axes) => ({
      ...axes,
      controlTransition: axes.controlTransition === "none" ? "idle" : "none",
    }),
  ],
];

export const withSelectorDigest = (
  selector: PreflightStateSelector,
  patch: Partial<PreflightStateSelector>,
): unknown => {
  const { selectorDigest: _selectorDigest, ...body } = selector;
  const next = { ...body, ...patch };
  return { ...next, selectorDigest: sha256Hex(next) };
};

export const otherRole = (
  role: PreflightStateSelector["role"],
): "lead" | "head" => (role === "lead" ? "head" : "lead");

export const selfConsistentAxisDrift = (
  artifact: PreflightSegmentArtifact,
  mutate: (axes: MatrixAxes) => MatrixAxes,
): PreflightSegmentArtifact => {
  const axes = mutate(artifact.state.axes);
  const state = {
    ...artifact.state,
    axes,
    pairwiseDigest: sha256Hex(axes),
  };
  const segment = { ...artifact.segment, state };
  const { artifactDigest: _artifactDigest, ...artifactBody } = artifact;
  const body = {
    ...artifactBody,
    state,
    stateDigest: preflightJournalStateDigest({
      state,
      role: artifact.role,
      catalogRoute: artifact.catalogRoute,
      resolvedRoute: artifact.resolvedRoute,
    }),
    segment,
    segmentDigest: sha256Hex(segment),
  };
  return { ...body, artifactDigest: sha256Hex(body) };
};

export const artifactFor = (input: {
  readonly source: CampaignSource;
  readonly state: CampaignSource["plan"]["states"][number];
  readonly route: Parameters<typeof createPreflightSegmentArtifact>[0]["route"];
  readonly assignment: PreflightAssignment;
}): PreflightSegmentArtifact =>
  createPreflightSegmentArtifact({
    source: input.source,
    assignmentDigest: input.assignment.assignmentDigest,
    state: input.state,
    route: input.route,
    segment: { state: input.state, controls: [], specialized: [] },
  });
