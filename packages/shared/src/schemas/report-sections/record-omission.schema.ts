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
): {
  readonly risks: number;
  readonly decisions: number;
  readonly unknown: boolean;
} {
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
