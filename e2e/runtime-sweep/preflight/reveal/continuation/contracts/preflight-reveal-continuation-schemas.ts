import { z } from "zod";

import { revealTransitionSchema } from "../../../../matrix/reveal-transition.ts";
import { actionSchema } from "../../../../source/contracts.ts";
import { revealNonMutationProofSchema } from "../../../reveal-path.ts";
import {
  branchSchema,
  candidateListSchema,
  controlAssetSchema,
  domInventorySchema,
  inventoryAssetSchema,
  pathNodeSchema,
  reducerCheckpointSchema,
  representativeInputSchema,
  surfaceAssetSchema,
} from "./preflight-reveal-continuation-asset-schemas.ts";
import {
  routeSchema,
  runIdentitySchema,
} from "./preflight-reveal-continuation-run-schemas.ts";
import {
  assetRefSchema,
  canonicalRelativeUrlSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema,
  PREFLIGHT_REVEAL_BOOTSTRAP,
  PREFLIGHT_REVEAL_CONTINUATION_VERSION,
  PREFLIGHT_REVEAL_EXECUTION_GRANT,
  PREFLIGHT_REVEAL_PARENT_PASS,
  PREFLIGHT_REVEAL_RECEIPT_CHUNK,
  PREFLIGHT_REVEAL_TERMINAL_RECEIPT,
} from "./preflight-reveal-continuation-schema-primitives.ts";

export * from "./preflight-reveal-continuation-asset-schemas.ts";
export * from "./preflight-reveal-continuation-schema-primitives.ts";

const chainHeadsSchema = z
  .object({
    receiptHead: assetRefSchema.nullable(),
    receiptCount: nonNegativeIntegerSchema,
    chunkHead: assetRefSchema.nullable(),
    chunkCount: nonNegativeIntegerSchema,
  })
  .strict();
const continuationBoundsSchema = z
  .object({
    maxDepth: positiveIntegerSchema,
    maxRevealMaterialEdges: positiveIntegerSchema,
    maxRevealActions: positiveIntegerSchema,
    maxControlsPerSegment: positiveIntegerSchema,
  })
  .strict();

const genesisRefsSchema = z
  .object({
    inventoryRef: assetRefSchema,
    inventoryDigest: assetRefSchema,
    surfaceRef: assetRefSchema,
    surfaceDigest: assetRefSchema,
    pathNodeRef: assetRefSchema,
    pathDigest: assetRefSchema,
    branchRef: assetRefSchema,
    branchDigest: assetRefSchema,
    candidateListRef: assetRefSchema,
    candidateListDigest: assetRefSchema,
    url: canonicalRelativeUrlSchema,
  })
  .strict();
const frontierSchema = z
  .object({
    branchRef: assetRefSchema,
    branchDigest: assetRefSchema,
    pathNodeRef: assetRefSchema,
    pathDigest: assetRefSchema,
    inventoryRef: assetRefSchema,
    inventoryDigest: assetRefSchema,
    surfaceRef: assetRefSchema,
    surfaceDigest: assetRefSchema,
    url: canonicalRelativeUrlSchema,
    candidateListRef: assetRefSchema,
    candidateListDigest: assetRefSchema,
    queueRefs: z.array(assetRefSchema).readonly(),
    nextCandidateIndex: nonNegativeIntegerSchema,
    nextCandidateId: assetRefSchema,
    actionCount: nonNegativeIntegerSchema,
    branchCount: nonNegativeIntegerSchema,
    completedCandidateCount: nonNegativeIntegerSchema,
  })
  .strict();
const reducerStateSnapshotSchema = z
  .object({
    checkpointRef: assetRefSchema,
  })
  .strict();

const receiptBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_TERMINAL_RECEIPT),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    sequence: positiveIntegerSchema,
    predecessorDigest: assetRefSchema.nullable(),
    branchRef: assetRefSchema,
    branchDigest: assetRefSchema,
    pathNodeRef: assetRefSchema,
    pathDigest: assetRefSchema,
    candidateListRef: assetRefSchema,
    candidateListDigest: assetRefSchema,
    candidateIndex: nonNegativeIntegerSchema,
    candidateId: assetRefSchema,
    action: actionSchema,
    representativeInput: representativeInputSchema,
    transition: revealTransitionSchema,
    terminal: z
      .object({
        terminalBranchRef: assetRefSchema,
        postActionInventoryRef: assetRefSchema,
        postActionInventoryDigest: assetRefSchema,
        pathNodeRef: assetRefSchema,
        pathDigest: assetRefSchema,
        surfaceRef: assetRefSchema,
        surfaceDigest: assetRefSchema,
        url: canonicalRelativeUrlSchema,
        nonMutation: revealNonMutationProofSchema,
        enqueuedBranchRef: assetRefSchema.nullable(),
      })
      .strict(),
    nextFrontier: z
      .object({
        branchRef: assetRefSchema,
        branchDigest: assetRefSchema,
        candidateListRef: assetRefSchema,
        candidateListDigest: assetRefSchema,
      })
      .strict()
      .nullable(),
    materialChanged: z.boolean(),
    actionCount: nonNegativeIntegerSchema,
    branchCount: nonNegativeIntegerSchema,
    completedCandidateCount: positiveIntegerSchema,
  })
  .strict();
export const receiptSchema = receiptBodySchema
  .extend({ digest: assetRefSchema })
  .strict();

/** One chunk carries only a new disjoint suffix, never a repeated prefix. */
export const receiptChunkBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_RECEIPT_CHUNK),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    status: z.enum(["YIELD", "BRANCH_EXHAUSTED"]),
    run: runIdentitySchema,
    grantDigest: assetRefSchema,
    predecessorReceiptHead: assetRefSchema.nullable(),
    predecessorReceiptCount: nonNegativeIntegerSchema,
    receiptHead: assetRefSchema,
    receiptCount: positiveIntegerSchema,
    predecessorChunkHead: assetRefSchema.nullable(),
    predecessorChunkCount: nonNegativeIntegerSchema,
    chunkSequence: positiveIntegerSchema,
    receipts: z.array(receiptSchema).min(1).readonly(),
    authorityTag: z.null(),
  })
  .strict();
export const receiptChunkSchema = receiptChunkBodySchema
  .extend({ chunkDigest: assetRefSchema })
  .strict();

const bootstrapBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_BOOTSTRAP),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    status: z.literal("EMPTY_FRONTIER"),
    run: runIdentitySchema,
    genesis: genesisRefsSchema,
    bounds: continuationBoundsSchema,
    reducerStateDigest: assetRefSchema,
    controlsDigest: assetRefSchema,
    controlsCount: nonNegativeIntegerSchema,
    authorityTag: z.null(),
  })
  .strict();
export const bootstrapSchema = bootstrapBodySchema
  .extend({ bootstrapDigest: assetRefSchema })
  .strict();

const executionGrantBodySchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_EXECUTION_GRANT),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    status: z.literal("EXECUTION_GRANT"),
    run: runIdentitySchema,
    chain: chainHeadsSchema,
    genesis: genesisRefsSchema,
    frontier: frontierSchema,
    reducerState: reducerStateSnapshotSchema,
    bounds: continuationBoundsSchema,
    reducerStateDigest: assetRefSchema,
    authorityTag: assetRefSchema,
  })
  .strict();
export const executionGrantSchema = executionGrantBodySchema
  .extend({ grantDigest: assetRefSchema })
  .strict();
export const parentPassSchema = z
  .object({
    artifact: z.literal(PREFLIGHT_REVEAL_PARENT_PASS),
    version: z.literal(PREFLIGHT_REVEAL_CONTINUATION_VERSION),
    status: z.literal("PASS"),
    run: runIdentitySchema,
    chain: chainHeadsSchema,
    reducerStateDigest: assetRefSchema,
    controlsDigest: assetRefSchema,
    controlsCount: nonNegativeIntegerSchema,
    passDigest: assetRefSchema,
    authorityTag: assetRefSchema,
  })
  .strict();

export type SerializableRevealInventory = z.infer<typeof domInventorySchema>;
export type RevealContinuationRoute = z.infer<typeof routeSchema>;
export type RevealContinuationFrontier = z.infer<typeof frontierSchema>;
export type RevealContinuationReceipt = z.infer<typeof receiptSchema>;
export type RevealExecutionGrant = z.infer<typeof executionGrantSchema>;
export type RevealBootstrap = z.infer<typeof bootstrapSchema>;
export type RevealReceiptChunk = z.infer<typeof receiptChunkSchema>;
export type RevealParentPass = z.infer<typeof parentPassSchema>;
export type RevealInventoryAsset = z.infer<typeof inventoryAssetSchema>;
export type RevealSurfaceAsset = z.infer<typeof surfaceAssetSchema>;
export type RevealPathNode = z.infer<typeof pathNodeSchema>;
export type RevealCandidateList = z.infer<typeof candidateListSchema>;
export type RevealBranchAsset = z.infer<typeof branchSchema>;
export type RevealControlAsset = z.infer<typeof controlAssetSchema>;
export type RevealReducerCheckpoint = z.infer<typeof reducerCheckpointSchema>;
