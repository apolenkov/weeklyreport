/** Submitted and expected lead counts for one period. */
export interface ReportProgress {
  readonly submitted: number;
  readonly total: number;
}

/**
 * Weekly submission progress: each expected lead counts once, and counts as
 * submitted when any of their sections is submitted. Submissions by authors
 * outside `expectedLeadIds` never enter the numerator, so `submitted <= total`.
 */
export function computeReportProgress(
  expectedLeadIds: Iterable<string>,
  sections: readonly { authorId: string; status: string }[],
): ReportProgress {
  const expected = new Set(expectedLeadIds);
  const submitted = new Set(
    sections
      .filter(
        ({ authorId, status }) =>
          status === "submitted" && expected.has(authorId),
      )
      .map(({ authorId }) => authorId),
  );
  return { submitted: submitted.size, total: expected.size };
}
