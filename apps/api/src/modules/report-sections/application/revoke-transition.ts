import type { Prisma } from "@prisma/client";

// The submitted guard makes concurrent revoke/verdict transitions apply once.
// Keep version unchanged so the verdict stays current until the next edit/save.
export async function applyRevokeTransition(
  tx: Pick<Prisma.TransactionClient, "reportSection">,
  sectionId: string,
  revokedBy: string,
  options: {
    readonly scope: Prisma.ReportSectionWhereInput;
    readonly expectedVersion?: number;
  },
): Promise<number> {
  const result = await tx.reportSection.updateMany({
    where: {
      AND: [
        {
          id: sectionId,
          status: "submitted",
          report: {
            archived: false,
            periodStatus: { in: ["open", "reopened"] },
          },
          ...(options.expectedVersion === undefined
            ? {}
            : { version: options.expectedVersion }),
        },
        options.scope,
      ],
    },
    data: {
      status: "draft",
      revokedAt: new Date(),
      revokedBy,
      submittedAt: null,
    },
  });
  return result.count;
}
