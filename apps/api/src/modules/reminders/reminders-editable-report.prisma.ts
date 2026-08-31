import type { Prisma } from "@prisma/client";

// Reminder delivery is valid only while the report is actively editable. The
// two tuples are the exact lifecycle outputs for an initial open report and a
// published report reopened for another editing pass.
export const editableReminderReportWhere = {
  deadline: { not: null },
  archived: false,
  periodState: "open",
  OR: [
    { status: "draft", periodStatus: "open" },
    { status: "published", periodStatus: "reopened" },
  ],
} as const satisfies Prisma.ReportWhereInput;
