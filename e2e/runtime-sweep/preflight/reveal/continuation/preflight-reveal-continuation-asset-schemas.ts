import { z } from "zod";

import { matrixPreflightControlSchema } from "../../../matrix/finalization/matrix-finalizer-preflight-contract.ts";
import { actionSchema } from "../../../source/contracts.ts";
import {
  revealNonMutationProofSchema,
  revealSurfaceSchema,
} from "../../reveal-path.ts";
import {
  assetRefSchema,
  canonicalRelativeUrlSchema,
  nonNegativeIntegerSchema,
  PREFLIGHT_REVEAL_BRANCH,
  PREFLIGHT_REVEAL_CANDIDATE_LIST,
  PREFLIGHT_REVEAL_CONTINUATION_VERSION,
  PREFLIGHT_REVEAL_CONTROL,
  PREFLIGHT_REVEAL_INVENTORY,
  PREFLIGHT_REVEAL_PATH_NODE,
  PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
  PREFLIGHT_REVEAL_SURFACE,
} from "./preflight-reveal-continuation-schema-primitives.ts";

const reducerRegistrationAssetSchema = z
  .object({
    signatureDigest: assetRefSchema,
    pathDigest: assetRefSchema,
    surfaceDigest: assetRefSchema,
  })
  .strict();

const reducerCheckpointControlsSchema = z
  .object({
    refs: z.array(assetRefSchema).readonly(),
    digest: assetRefSchema,
    count: nonNegativeIntegerSchema,
  })
  .strict();

export const controlAssetSchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_CONTROL),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    digest: assetRefSchema,
    control: matrixPreflightControlSchema,
  })
  .strict();

const domControlSchema = z
  .object({
    controlKey: z.string().min(1),
    domOrderKey: z.string().min(1),
    order: nonNegativeIntegerSchema,
    role: z.string().min(1),
    accessibleName: z.string(),
    enabled: z.boolean(),
    disabled: z.boolean(),
    visible: z.boolean(),
    tagName: z.string().min(1),
    inputType: z.string().nullable(),
    href: z.string().nullable(),
    recordStableId: z.uuid().optional(),
    interactionEffect: z.enum(["client-only", "mutation-required"]).optional(),
    keyboardExpectedFocusable: z.boolean().optional(),
    keyboardFocusPolicy: z
      .enum(["required", "forbidden", "unreachable"])
      .optional(),
    keyboardFocusScope: z
      .enum(["page", "active-modal", "background"])
      .optional(),
  })
  .strict()
  .superRefine((control, context) => {
    if (control.enabled === control.disabled)
      context.addIssue({
        code: "custom",
        path: ["disabled"],
        message: "enabled and disabled must be opposites",
      });
  });

export const domInventorySchema = z
  .object({
    controls: z.array(domControlSchema).readonly(),
    issues: z
      .array(
        z
          .object({
            kind: z.literal("missing-accessible-name"),
            controlKey: z.string().min(1),
            message: z.string().min(1),
          })
          .strict(),
      )
      .readonly(),
    visibleText: z.string().optional(),
  })
  .strict()
  .superRefine((inventory, context) => {
    const keys = inventory.controls.map(({ controlKey }) => controlKey);
    if (new Set(keys).size !== keys.length)
      context.addIssue({
        code: "custom",
        path: ["controls"],
        message: "DOM inventory contains duplicate control keys",
      });
  });

export const representativeInputSchema = z
  .union([
    z.object({ kind: z.literal("fill"), value: z.string().min(1) }).strict(),
    z
      .object({
        kind: z.literal("select"),
        value: z.string().min(1),
        index: nonNegativeIntegerSchema,
      })
      .strict(),
  ])
  .nullable();

export const inventoryAssetSchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_INVENTORY),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    digest: assetRefSchema,
    inventory: domInventorySchema,
  })
  .strict();

export const surfaceAssetSchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_SURFACE),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    digest: assetRefSchema,
    surface: revealSurfaceSchema,
  })
  .strict();

const pathNodeStepSchema = z
  .object({
    controlKey: z.string().min(1),
    action: actionSchema,
    representativeInput: representativeInputSchema,
    beforeSurfaceDigest: assetRefSchema,
    afterSurfaceDigest: assetRefSchema,
    beforeUrl: canonicalRelativeUrlSchema,
    afterUrl: canonicalRelativeUrlSchema,
    nonMutation: revealNonMutationProofSchema,
  })
  .strict();

export const pathNodeSchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_PATH_NODE),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    digest: assetRefSchema,
    parentPathDigest: assetRefSchema.nullable(),
    depth: nonNegativeIntegerSchema,
    step: pathNodeStepSchema.nullable(),
    url: canonicalRelativeUrlSchema,
    surfaceRef: assetRefSchema,
    surfaceDigest: assetRefSchema,
  })
  .strict();

const candidateSchema = z
  .object({
    candidateId: assetRefSchema,
    action: actionSchema,
    representativeInput: representativeInputSchema,
  })
  .strict();

export const candidateListSchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_CANDIDATE_LIST),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    digest: assetRefSchema,
    branchDigest: assetRefSchema,
    candidates: z.array(candidateSchema).readonly(),
  })
  .strict()
  .superRefine((list, context) => {
    const ids = list.candidates.map(({ candidateId }) => candidateId);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        path: ["candidates"],
        message: "candidate ids must be unique",
      });
  });

export const branchSchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_BRANCH),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    digest: assetRefSchema,
    pathNodeRef: assetRefSchema,
    pathDigest: assetRefSchema,
    inventoryRef: assetRefSchema,
    inventoryDigest: assetRefSchema,
    surfaceRef: assetRefSchema,
    surfaceDigest: assetRefSchema,
    url: canonicalRelativeUrlSchema,
    depth: nonNegativeIntegerSchema,
  })
  .strict();

export const reducerCheckpointSchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_REDUCER_CHECKPOINT),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    digest: assetRefSchema,
    controls: reducerCheckpointControlsSchema,
    discovered: z
      .array(
        z.tuple([z.string().min(1), reducerRegistrationAssetSchema]).readonly(),
      )
      .readonly(),
    visitedStatePaths: z
      .array(z.tuple([z.string().min(1), assetRefSchema]).readonly())
      .readonly(),
    queueRefs: z.array(assetRefSchema).readonly(),
    currentBranchRef: assetRefSchema.nullable(),
    currentCandidatesRef: assetRefSchema.nullable(),
    currentCandidatesDigest: assetRefSchema.nullable(),
    currentCandidateIndex: nonNegativeIntegerSchema.nullable(),
    actionCount: nonNegativeIntegerSchema,
    branchCount: nonNegativeIntegerSchema,
  })
  .strict();
