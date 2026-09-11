import { copyScalarSearchParams } from "./scalar-search-param";

// Shared report navigation preserves unrelated query context, but never
// carries an ambiguous scalar control into the next addressed report.
export function copyReportSearchParams(
  searchParams: Pick<URLSearchParams, "toString">,
): URLSearchParams {
  return copyScalarSearchParams(searchParams, [
    "mode",
    "authorId",
    "archive",
    "scope",
    "source",
    "recovery",
    "feedback",
    "feedbackUrl",
    "agentationSession",
    "agentationAnnotation",
  ]);
}
