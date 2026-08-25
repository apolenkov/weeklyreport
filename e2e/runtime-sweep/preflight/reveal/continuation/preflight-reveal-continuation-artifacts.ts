import { freezeDeep } from "../../../source/manifest-source.ts";
import {
  bootstrapSchema,
  executionGrantSchema,
  parentPassSchema,
  PREFLIGHT_REVEAL_CONTINUATION_VERSION,
  receiptChunkSchema,
  receiptSchema,
  type RevealBootstrap,
  type RevealContinuationReceipt,
  type RevealExecutionGrant,
  type RevealParentPass,
  type RevealReceiptChunk,
} from "./contracts/preflight-reveal-continuation-schemas.ts";
import {
  bootstrapDigestForBody,
  canonicalBytesFor,
  hmacFor,
  parentPassDigestForBody,
  R188_ZERO_DIGEST,
} from "./preflight-reveal-continuation-digests.ts";
import { RevealContinuationError } from "./preflight-reveal-continuation-errors.ts";
import {
  assertExecutionGrantContract,
  assertReceiptChunkContract,
  assertReceiptContract,
} from "./preflight-reveal-continuation-validators.ts";

export const parseRevealExecutionGrant = (
  value: unknown,
): RevealExecutionGrant => {
  try {
    const parsed = executionGrantSchema.parse(value);
    assertExecutionGrantContract(parsed);
    return freezeDeep(parsed);
  } catch (error: unknown) {
    if (error instanceof RevealContinuationError) throw error;
    throw new RevealContinuationError(
      `R188 execution grant rejected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const parseRevealReceiptChunk = (value: unknown): RevealReceiptChunk => {
  try {
    const parsed = receiptChunkSchema.parse(value);
    assertReceiptChunkContract(parsed);
    return freezeDeep(parsed);
  } catch (error: unknown) {
    if (error instanceof RevealContinuationError) throw error;
    throw new RevealContinuationError(
      `R188 receipt chunk rejected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const parseRevealBootstrap = (value: unknown): RevealBootstrap => {
  try {
    const parsed = bootstrapSchema.parse(value);
    const { bootstrapDigest: _bootstrapDigest, ...body } = parsed;
    if (bootstrapDigestForBody(body) !== parsed.bootstrapDigest)
      throw new RevealContinuationError("R188 bootstrap digest drifted");
    return freezeDeep(parsed);
  } catch (error: unknown) {
    if (error instanceof RevealContinuationError) throw error;
    throw new RevealContinuationError(
      `R188 bootstrap rejected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const parseRevealParentPass = (value: unknown): RevealParentPass => {
  try {
    const parsed = parentPassSchema.parse(value);
    const { passDigest: _passDigest, ...body } = parsed;
    if (parentPassDigestForBody(body) !== parsed.passDigest)
      throw new RevealContinuationError("R188 parent pass digest drifted");
    return freezeDeep(parsed);
  } catch (error: unknown) {
    if (error instanceof RevealContinuationError) throw error;
    throw new RevealContinuationError(
      `R188 parent pass rejected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const parseRevealTerminalReceipt = (
  value: unknown,
): RevealContinuationReceipt => {
  try {
    const parsed = receiptSchema.parse(value);
    assertReceiptContract(parsed);
    return freezeDeep(parsed);
  } catch (error: unknown) {
    if (error instanceof RevealContinuationError) throw error;
    throw new RevealContinuationError(
      `R188 terminal receipt rejected: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const createParentPass = (input: {
  readonly run: RevealParentPass["run"];
  readonly chain: RevealParentPass["chain"];
  readonly reducerStateDigest: string;
  readonly controlsDigest: string;
  readonly controlsCount: number;
  readonly authorityKey: string;
}): RevealParentPass => {
  const unsigned = {
    artifact: "PREFLIGHT_REVEAL_PARENT_PASS" as const,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    status: "PASS" as const,
    run: input.run,
    chain: input.chain,
    reducerStateDigest: input.reducerStateDigest,
    controlsDigest: input.controlsDigest,
    controlsCount: input.controlsCount,
    passDigest: R188_ZERO_DIGEST,
    authorityTag: R188_ZERO_DIGEST,
  };
  const authorityTag = hmacFor(input.authorityKey, "parent-pass", unsigned);
  const body = { ...unsigned, authorityTag };
  const { passDigest: _passDigest, ...digestBody } = body;
  return parentPassSchema.parse({
    ...body,
    passDigest: parentPassDigestForBody(digestBody),
  });
};

export const createRevealBootstrap = (input: {
  readonly run: RevealBootstrap["run"];
  readonly genesis: RevealBootstrap["genesis"];
  readonly bounds: RevealBootstrap["bounds"];
  readonly reducerStateDigest: string;
  readonly controlsDigest: string;
  readonly controlsCount: number;
}): RevealBootstrap => {
  const body = {
    artifact: "PREFLIGHT_REVEAL_BOOTSTRAP" as const,
    version: PREFLIGHT_REVEAL_CONTINUATION_VERSION,
    status: "EMPTY_FRONTIER" as const,
    run: input.run,
    genesis: input.genesis,
    bounds: input.bounds,
    reducerStateDigest: input.reducerStateDigest,
    controlsDigest: input.controlsDigest,
    controlsCount: input.controlsCount,
    authorityTag: null,
  };
  return parseRevealBootstrap({
    ...body,
    bootstrapDigest: bootstrapDigestForBody(body),
  });
};

export const serializeV4 = (value: unknown): string =>
  `${new TextDecoder().decode(canonicalBytesFor(value))}\n`;
