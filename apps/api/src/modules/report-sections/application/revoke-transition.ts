import type { Prisma } from "@prisma/client";

// The submitted guard makes concurrent revoke/verdict transitions apply once.
// Keep version unchanged so the verdict stays current until the next edit/save.
export async function applyRevokeTransition(
  tx: Pick<Prisma.TransactionClient, "reportSection">,
  sectionId: string,
  revokedBy: string,
  expectedVersion?: number,
): Promise<number> {
  const result = await tx.reportSection.updateMany({
    where: {
      id: sectionId,
      status: "submitted",
      report: { periodStatus: { in: ["open", "reopened"] } },
      ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
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
