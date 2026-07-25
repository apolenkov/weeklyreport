import { Prisma } from "@prisma/client";

// Captured by durable stableId+kind (not volatile PK) so comments re-attach
// after saveSection delete-recreates anchor rows.
type RecordKind = "item" | "risk" | "decision";
export interface CapturedComment {
  stableId: string;
  kind: RecordKind;
  reviewerId: string;
  text: string;
  createdAt: Date;
}

const lineageKey = (kind: RecordKind, stableId: string): string =>
  `${kind}::${stableId}`;

/**
 * Read every RecordComment anchored to a record in this section, tagged with
 * its anchor's `stableId` + kind, BEFORE the child rows are deleted (the
 * delete cascades the comments away). One join per anchor kind; exactly one
 * relation is set per comment.
 */
export async function captureRecordComments(
  tx: Prisma.TransactionClient,
  sectionId: string,
): Promise<CapturedComment[]> {
  const comments = await tx.recordComment.findMany({
    where: {
      OR: [
        { item: { reportSectionId: sectionId } },
        { risk: { reportSectionId: sectionId } },
        { decision: { reportSectionId: sectionId } },
      ],
    },
    select: {
      reviewerId: true,
      text: true,
      createdAt: true,
      item: { select: { stableId: true } },
      risk: { select: { stableId: true } },
      decision: { select: { stableId: true } },
    },
  });

  return comments.flatMap((comment) => {
    const anchor = comment.item
      ? ({ kind: "item", stableId: comment.item.stableId } as const)
      : comment.risk
        ? ({ kind: "risk", stableId: comment.risk.stableId } as const)
        : comment.decision
          ? ({ kind: "decision", stableId: comment.decision.stableId } as const)
          : null;
    if (!anchor) return [];
    return [
      {
        stableId: anchor.stableId,
        kind: anchor.kind,
        reviewerId: comment.reviewerId,
        text: comment.text,
        createdAt: comment.createdAt,
      },
    ];
  });
}

/**
 * Re-anchor captured comments onto the freshly recreated records. Records are
 * matched by lineage (stableId + kind); a comment whose lineage is gone (its
 * record was dropped from the payload this save) is NOT re-inserted, so it
 * hard-dies exactly when the record it flagged is genuinely removed. Runs
 * inside saveSection's transaction, so it is atomic with the version bump.
 */
export async function reinsertRecordComments(
  tx: Prisma.TransactionClient,
  sectionId: string,
  captured: readonly CapturedComment[],
): Promise<void> {
  if (captured.length === 0) return;

  const [items, risks, decisions] = await Promise.all([
    tx.item.findMany({
      where: { reportSectionId: sectionId },
      select: { id: true, stableId: true },
    }),
    tx.risk.findMany({
      where: { reportSectionId: sectionId },
      select: { id: true, stableId: true },
    }),
    tx.decision.findMany({
      where: { reportSectionId: sectionId },
      select: { id: true, stableId: true },
    }),
  ]);

  const lineageEntries = (
    kind: RecordKind,
    rows: readonly { id: string; stableId: string }[],
  ): [string, string][] =>
    rows.map((row) => [lineageKey(kind, row.stableId), row.id]);

  const idByLineage = new Map<string, string>([
    ...lineageEntries("item", items),
    ...lineageEntries("risk", risks),
    ...lineageEntries("decision", decisions),
  ]);

  const data = captured.flatMap((comment) => {
    const newRecordId = idByLineage.get(
      lineageKey(comment.kind, comment.stableId),
    );
    if (newRecordId === undefined) return [];
    return [
      {
        reviewerId: comment.reviewerId,
        text: comment.text,
        // Preserve the original authoring timestamp across the recreate.
        createdAt: comment.createdAt,
        itemId: comment.kind === "item" ? newRecordId : null,
        riskId: comment.kind === "risk" ? newRecordId : null,
        decisionId: comment.kind === "decision" ? newRecordId : null,
      },
    ];
  });

  if (data.length > 0) await tx.recordComment.createMany({ data });
}
