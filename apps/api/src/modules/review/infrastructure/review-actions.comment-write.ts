import type { RecordCommentView } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { isForeignKeyViolation } from "../../../lib/prisma-foreign-key-violation.js";
import { ReviewNotFoundError } from "../application/review.service.js";
import type {
  RecordAnchor,
  ReviewWriteActor,
} from "../application/review-actions.service.js";
import {
  assertReviewEntitlement,
  lockEditableReport,
  lockReviewUsers,
} from "./review-write-gate.js";

type RecordKind = "item" | "risk" | "decision";

// Every anchor-resolution failure reports the same not-found shape.
function throwAnchorNotFound(): never {
  throw new ReviewNotFoundError("Record not found.");
}

interface AnchorLineageRow {
  readonly stableId: string;
  readonly reportSectionId: string;
  readonly reportSection: { reportId: string; authorId: string };
}

interface AnchorLineage {
  readonly kind: RecordKind;
  readonly stableId: string;
  readonly reportSectionId: string;
  readonly reportId: string;
  readonly authorId: string;
}

const anchorLineageSelect = {
  stableId: true,
  reportSectionId: true,
  reportSection: { select: { reportId: true, authorId: true } },
} as const;

const createdCommentSelect = {
  id: true,
  reviewerId: true,
  text: true,
  createdAt: true,
  reviewer: { select: { name: true } },
} as const;

function toLineage(
  kind: RecordKind,
  row: AnchorLineageRow | null,
): AnchorLineage {
  if (row === null) throwAnchorNotFound();
  return {
    kind,
    stableId: row.stableId,
    reportSectionId: row.reportSectionId,
    reportId: row.reportSection.reportId,
    authorId: row.reportSection.authorId,
  };
}

async function loadAnchorLineage(
  tx: Prisma.TransactionClient,
  anchor: RecordAnchor,
): Promise<AnchorLineage> {
  if (anchor.itemId !== undefined) {
    const row = await tx.item.findUnique({
      where: { id: anchor.itemId },
      select: anchorLineageSelect,
    });
    return toLineage("item", row);
  }
  if (anchor.riskId !== undefined) {
    const row = await tx.risk.findUnique({
      where: { id: anchor.riskId },
      select: anchorLineageSelect,
    });
    return toLineage("risk", row);
  }
  if (anchor.decisionId !== undefined) {
    const row = await tx.decision.findUnique({
      where: { id: anchor.decisionId },
      select: anchorLineageSelect,
    });
    return toLineage("decision", row);
  }
  throwAnchorNotFound();
}

async function loadCurrentAnchorId(
  tx: Prisma.TransactionClient,
  lineage: AnchorLineage,
): Promise<string> {
  const where = {
    reportSectionId_stableId: {
      reportSectionId: lineage.reportSectionId,
      stableId: lineage.stableId,
    },
  };
  const row =
    lineage.kind === "item"
      ? await tx.item.findUnique({ where, select: { id: true } })
      : lineage.kind === "risk"
        ? await tx.risk.findUnique({ where, select: { id: true } })
        : await tx.decision.findUnique({ where, select: { id: true } });
  if (row === null) throwAnchorNotFound();
  return row.id;
}

// The anchor FK a P2003 can trip — only a violation on THIS constraint means
// the record vanished between the lineage re-read and the insert. A P2003 on
// the reviewer FK (reviewer deleted mid-transaction) is a different integrity
// failure and must NOT be reported as a missing record.
const ANCHOR_FK_CONSTRAINT: Record<RecordKind, string> = {
  item: "RecordComment_itemId_fkey",
  risk: "RecordComment_riskId_fkey",
  decision: "RecordComment_decisionId_fkey",
};

async function createComment(
  tx: Prisma.TransactionClient,
  lineage: AnchorLineage,
  currentAnchorId: string,
  content: { readonly reviewerId: string; readonly text: string },
): Promise<RecordCommentView> {
  const { reviewerId, text } = content;
  try {
    const created = await tx.recordComment.create({
      data: {
        reviewerId,
        text,
        itemId: lineage.kind === "item" ? currentAnchorId : null,
        riskId: lineage.kind === "risk" ? currentAnchorId : null,
        decisionId: lineage.kind === "decision" ? currentAnchorId : null,
      },
      select: createdCommentSelect,
    });
    return {
      id: created.id,
      reviewerId: created.reviewerId,
      reviewerName: created.reviewer.name,
      text: created.text,
      createdAt: created.createdAt,
    };
  } catch (error) {
    if (
      isForeignKeyViolation(error, {
        index: ANCHOR_FK_CONSTRAINT[lineage.kind],
      })
    ) {
      throwAnchorNotFound();
    }
    throw error;
  }
}

// Takes the same Report-row lock ordering as the section delete-recreate
// transaction, then anchors the comment by durable lineage.
export function insertCoordinatedComment(
  prisma: PrismaService,
  actor: ReviewWriteActor,
  anchor: RecordAnchor,
  text: string,
): Promise<RecordCommentView> {
  return prisma.$transaction(async (tx) => {
    const lineage = await loadAnchorLineage(tx, anchor);
    await lockReviewUsers(tx, [actor.userId, lineage.authorId]);
    await lockEditableReport(tx, lineage.reportId);
    const section = await tx.reportSection.findFirst({
      where: { id: lineage.reportSectionId, reportId: lineage.reportId },
      select: {
        authorId: true,
        author: { select: { reportingGroupId: true } },
      },
    });
    if (!section) throwAnchorNotFound();
    if (section.authorId !== lineage.authorId) throwAnchorNotFound();
    const groupId = section.author.reportingGroupId;
    if (!groupId) throw new ReviewNotFoundError("Review group not found.");
    await assertReviewEntitlement(tx, actor, groupId);
    const currentAnchorId = await loadCurrentAnchorId(tx, lineage);
    return createComment(tx, lineage, currentAnchorId, {
      reviewerId: actor.userId,
      text,
    });
  });
}
