import { z } from "zod";

import { getScalarSearchParam } from "./scalar-search-param";

const sourceSchema = z.object({
  reportId: z.uuid(),
  reportSectionId: z.uuid(),
  kind: z.enum(["risk", "decision"]),
  stableId: z.uuid(),
});

export type RetainedDraftCopySource = Readonly<z.infer<typeof sourceSchema>>;

const queryKeys = {
  reportId: "copyReportId",
  reportSectionId: "copySectionId",
  kind: "copyKind",
  stableId: "copyStableId",
} as const;

// Identifiers are a read request, never authority or a serialized private draft.
export function readRetainedDraftCopy(
  query: Pick<URLSearchParams, "getAll">,
): RetainedDraftCopySource | null {
  const source = Object.fromEntries(
    Object.entries(queryKeys).map(([field, key]) => [
      field,
      getScalarSearchParam(query, key),
    ]),
  );
  const parsed = sourceSchema.safeParse(source);
  return parsed.success ? parsed.data : null;
}

export function writeRetainedDraftCopy(
  query: URLSearchParams,
  source: RetainedDraftCopySource | null,
): void {
  for (const [field, key] of Object.entries(queryKeys)) {
    query.delete(key);
    if (source) query.set(key, source[field as keyof RetainedDraftCopySource]);
  }
}
