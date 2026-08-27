import { zeroRevealOperationTotals } from "../../reveal/continuation/operation/preflight-reveal-operation-evidence-reducer.ts";
import type { ParentProgress } from "./preflight-reveal-continuation-parent.ts";

export const initialParentProgress = (): ParentProgress => ({
  previousGrantDigest: null,
  previousCompletedCandidateCount: 0,
  receiptHead: null,
  receiptCount: 0,
  chunkHead: null,
  chunkCount: 0,
  operationHead: null,
  operationChunkCount: 0,
  operationTotals: zeroRevealOperationTotals(),
  previousCheckpointDigest: null,
  previousSampleSequence: null,
});
