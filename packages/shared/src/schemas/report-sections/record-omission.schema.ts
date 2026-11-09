import { z } from "zod";

/** Internal aggregate scope keys contain no record identities or text. */
export const recordOmissionBucketSchema = z
  .strictObject({
    kind: z.enum(["risk", "decision"]),
    parentKind: z.enum(["product", "activity"]),
    parentId: z.uuid(),
    stageNames: z.array(z.string().min(1)).readonly(),
    count: z.number().int().positive(),
  })
  .superRefine((bucket, ctx) => {
    if (
      (bucket.parentKind === "activity" && bucket.stageNames.length > 0) ||
      (bucket.parentKind === "product" && bucket.stageNames.length === 0) ||
      bucket.stageNames.some(
        (name, index) =>
          index > 0 && name <= (bucket.stageNames[index - 1] ?? ""),
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Stage names must be a canonical set for the parent.",
      });
    }
  })
  .readonly();

/** Versioned internal omission buckets for one section. */
export const recordOmissionSchema = z
  .strictObject({
    version: z.literal(1),
    buckets: z.array(recordOmissionBucketSchema).readonly(),
  })
  .readonly();

/** Validated internal omission metadata. */
export type RecordOmission = z.infer<typeof recordOmissionSchema>;

/**
 * Public omission disclosure: totals only, never bucket keys, identities or
 * text. `unknown` marks a corpus with at least one legacy section that carries
 * no omission metadata, so its totals are a lower bound rather than a count.
 */
export const recordOmissionSummarySchema = z
  .strictObject({
    risks: z.number().int().nonnegative(),
    decisions: z.number().int().nonnegative(),
    unknown: z.boolean(),
  })
  .readonly();

/** Public omission totals carried beside search, assistant and report reads. */
export type RecordOmissionSummary = z.infer<typeof recordOmissionSummarySchema>;

/** Authorized subject and optional stage filter. */
export interface RecordOmissionScope {
  readonly parentKind: "product" | "activity";
  readonly parentId: string;
  readonly stageNames?: readonly string[];
}

/** Public totals omit bucket keys; unknown indicates at least one legacy section. */
export function summarizeRecordOmissions(
  sections: readonly (RecordOmission | undefined)[],
  scope?: RecordOmissionScope,
): RecordOmissionSummary {
  return sections.reduce<{
    risks: number;
    decisions: number;
    unknown: boolean;
  }>(
    (summary, section) => {
      if (!section) return { ...summary, unknown: true };
      return section.buckets.reduce((result, bucket) => {
        if (
          scope &&
          (bucket.parentKind !== scope.parentKind ||
            bucket.parentId !== scope.parentId ||
            (scope.stageNames &&
              !bucket.stageNames.some((stage) =>
                scope.stageNames?.includes(stage),
              )))
        )
          return result;
        return bucket.kind === "risk"
          ? { ...result, risks: result.risks + bucket.count }
          : { ...result, decisions: result.decisions + bucket.count };
      }, summary);
    },
    { risks: 0, decisions: 0, unknown: false },
  );
}

/** Union authorized subject scopes before aggregating, without exposing buckets. */
export function summarizeRecordOmissionsForScopes(
  sections: readonly (RecordOmission | undefined)[],
  scopes: readonly RecordOmissionScope[],
): RecordOmissionSummary {
  if (scopes.length === 0) return summarizeRecordOmissions([]);
  return summarizeRecordOmissions(
    sections.map(
      (section) =>
        section && {
          ...section,
          buckets: section.buckets.filter((bucket) =>
            scopes.some(
              (scope) =>
                bucket.parentKind === scope.parentKind &&
                bucket.parentId === scope.parentId &&
                (!scope.stageNames ||
                  bucket.stageNames.some((stage) =>
                    scope.stageNames?.includes(stage),
                  )),
            ),
          ),
        },
    ),
  );
}

/**
 * Disclosure for a corpus whose omission totals have not been counted: it
 * reads as "records may be missing", never as "nothing omitted".
 */
export const UNCOUNTED_RECORD_OMISSIONS: RecordOmissionSummary = {
  risks: 0,
  decisions: 0,
  unknown: true,
};
