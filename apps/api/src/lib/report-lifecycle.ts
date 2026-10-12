import type { Prisma } from "@prisma/client";
import { currentPeriodLifecycleSchema } from "@weeklyreport/shared";

const EDITABLE_REPORT_LIFECYCLES = [
  {
    status: "draft",
    periodStatus: "open",
    periodState: "open",
    archived: false,
  },
  {
    status: "published",
    periodStatus: "reopened",
    periodState: "open",
    archived: false,
  },
] as const;

/** Lifecycle-only selector for scans whose existing policy has no date bound. */
export function editableReportLifecycleWhere(): Prisma.ReportWhereInput {
  return { OR: EDITABLE_REPORT_LIFECYCLES.map((tuple) => ({ ...tuple })) };
}

type EditableReportLockTarget =
  { readonly reportId: string } | { readonly sectionId: string };

type EditableReportLockResult =
  | { readonly kind: "editable"; readonly reportId: string }
  | { readonly kind: "not-found" }
  | { readonly kind: "inconsistent" }
  | { readonly kind: "not-editable" };

interface LockedReportLifecycleRow {
  readonly id: string;
  readonly status: string;
  readonly periodState: string;
  readonly periodStatus: string;
  readonly archived: boolean;
  readonly autoPublished: boolean;
  readonly autoArchived: boolean;
  readonly publishedAt: Date | null;
  readonly publishedById: string | null;
  readonly reopenedAt: Date | null;
}

async function readLockedReport(
  tx: Prisma.TransactionClient,
  target: EditableReportLockTarget,
): Promise<LockedReportLifecycleRow | undefined> {
  const rows =
    "reportId" in target
      ? await tx.$queryRaw<LockedReportLifecycleRow[]>`
          SELECT "id", "status", "periodState", "periodStatus", "archived",
            "autoPublished", "autoArchived", "publishedAt", "publishedById",
            "reopenedAt"
          FROM "Report"
          WHERE "id" = ${target.reportId}
          FOR UPDATE`
      : await tx.$queryRaw<LockedReportLifecycleRow[]>`
          SELECT report."id", report."status", report."periodState",
            report."periodStatus", report."archived", report."autoPublished",
            report."autoArchived", report."publishedAt",
            report."publishedById", report."reopenedAt"
          FROM "Report" AS report
          INNER JOIN "ReportSection" AS section
            ON section."reportId" = report."id"
          WHERE section."id" = ${target.sectionId}
          FOR UPDATE OF report`;
  return rows[0];
}

/** Locks the parent Report first and admits only an exact editable lifecycle. */
export async function lockCurrentEditableReport(
  tx: Prisma.TransactionClient,
  target: EditableReportLockTarget,
): Promise<EditableReportLockResult> {
  const report = await readLockedReport(tx, target);
  if (!report) return { kind: "not-found" };
  const lifecycle = currentPeriodLifecycleSchema.safeParse(report);
  if (!lifecycle.success) return { kind: "inconsistent" };
  const editable = EDITABLE_REPORT_LIFECYCLES.some(
    ({ status, periodStatus, periodState, archived }) =>
      lifecycle.data.status === status &&
      lifecycle.data.periodStatus === periodStatus &&
      lifecycle.data.periodState === periodState &&
      lifecycle.data.archived === archived,
  );
  return editable
    ? { kind: "editable", reportId: report.id }
    : { kind: "not-editable" };
}

/** The only lifecycle tuples eligible for the current editable report. */
export function currentEditableReportWhere(
  now = new Date(),
): Prisma.ReportWhereInput {
  return {
    periodStart: { lte: now },
    ...editableReportLifecycleWhere(),
  };
}
