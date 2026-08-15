import { z } from "zod";

import {
  resolverOutcomeIdentitySchema,
  sha256DigestSchema,
} from "../../../source/contracts.ts";
import { canonicalRevealUrlFor } from "../../reveal-path.ts";
import { R188_WIRE_VERSION } from "./preflight-reveal-continuation-digests.ts";

/** R192 wire version. Legacy cumulative continuation records are not accepted. */
export const PREFLIGHT_REVEAL_CONTINUATION_VERSION = R188_WIRE_VERSION;
export const PREFLIGHT_REVEAL_EXECUTION_GRANT =
  "PREFLIGHT_REVEAL_EXECUTION_GRANT" as const;
export const PREFLIGHT_REVEAL_RECEIPT_CHUNK =
  "PREFLIGHT_REVEAL_RECEIPT_CHUNK" as const;
export const PREFLIGHT_REVEAL_BOOTSTRAP = "PREFLIGHT_REVEAL_BOOTSTRAP" as const;
export const PREFLIGHT_REVEAL_TERMINAL_RECEIPT =
  "PREFLIGHT_REVEAL_TERMINAL_RECEIPT" as const;
export const PREFLIGHT_REVEAL_PARENT_PASS =
  "PREFLIGHT_REVEAL_PARENT_PASS" as const;
export const PREFLIGHT_REVEAL_INVENTORY = "PREFLIGHT_REVEAL_INVENTORY" as const;
export const PREFLIGHT_REVEAL_SURFACE = "PREFLIGHT_REVEAL_SURFACE" as const;
export const PREFLIGHT_REVEAL_PATH_NODE = "PREFLIGHT_REVEAL_PATH_NODE" as const;
export const PREFLIGHT_REVEAL_CANDIDATE_LIST =
  "PREFLIGHT_REVEAL_CANDIDATE_LIST" as const;
export const PREFLIGHT_REVEAL_BRANCH = "PREFLIGHT_REVEAL_BRANCH" as const;
export const PREFLIGHT_REVEAL_CONTROL = "PREFLIGHT_REVEAL_CONTROL" as const;
export const PREFLIGHT_REVEAL_REDUCER_CHECKPOINT =
  "PREFLIGHT_REVEAL_REDUCER_CHECKPOINT" as const;

export const nonNegativeIntegerSchema = z.number().int().nonnegative();
export const positiveIntegerSchema = z.number().int().positive();
export const assetRefSchema = sha256DigestSchema;
export const canonicalRelativeUrlSchema = z
  .string()
  .min(1)
  .superRefine((value, context) => {
    if (
      !value.startsWith("/") ||
      value.startsWith("//") ||
      canonicalRevealUrlFor(value) !== value
    )
      context.addIssue({
        code: "custom",
        message: "must be a canonical relative route URL",
      });
  });

export const resolverOutcomeExpectationSchema = z
  .object({
    identity: resolverOutcomeIdentitySchema.extend({
      sourceDigest: sha256DigestSchema,
    }),
    expectedTarget: canonicalRelativeUrlSchema,
    expectedUi: z.string().min(1),
  })
  .strict();
