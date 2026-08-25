import { z } from "zod";

import {
  matrixAxesSchema,
  roleSchema,
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
  sourceTreeSchema,
  stableIdentifierSchema,
} from "../../source/contracts.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import type { PreflightCanarySelection } from "../canary/preflight-canary-contract.ts";

/**
 * The complete identity needed to select one state from one current SOURCE.
 * `stateId` is deliberately not sufficient: every source, state, axis, and
 * route binding is carried and checked before a browser or database can run.
 */
export const preflightStateSelectorSchema = z
  .object({
    sourceSha: sourceShaSchema,
    sourceTree: sourceTreeSchema,
    treeDigest: sha256DigestSchema,
    sourceDigest: sha256DigestSchema,
    planDigest: sha256DigestSchema,
    stateId: stableIdentifierSchema,
    stateDigest: sha256DigestSchema,
    pairwiseDigest: sha256DigestSchema,
    profile: seedProfileSchema,
    axes: matrixAxesSchema,
    role: roleSchema,
    catalogRoute: z.string().trim().min(1),
    resolvedRoute: z.string().trim().min(1),
    selectorDigest: sha256DigestSchema,
  })
  .strict();

/**
 * A SHA-independent state tuple used only to find the corresponding state in
 * a new SOURCE. It intentionally has no stateId or source identity fields.
 */
export const preflightStateSemanticSelectorSchema = z
  .object({
    profile: seedProfileSchema,
    axes: matrixAxesSchema,
    role: roleSchema,
    catalogRoute: z.string().trim().min(1),
    resolvedRoute: z.string().trim().min(1),
  })
  .strict();

export type PreflightStateSelector = z.infer<
  typeof preflightStateSelectorSchema
>;
export type PreflightStateSemanticSelector = z.infer<
  typeof preflightStateSemanticSelectorSchema
>;
export type PreflightStateSelection = Readonly<{
  readonly selector: PreflightStateSelector;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightCanarySelection["route"];
}>;

export class PreflightStateSelectorError extends Error {
  override readonly name = "PreflightStateSelectorError";
}
