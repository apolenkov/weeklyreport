import { type AdminSnapshot, composeName } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { lockUserAndAssertActivityAssignments } from "../../../lib/user-activity-assignment.js";

export async function upsertUsers(
  tx: Prisma.TransactionClient,
  users: AdminSnapshot["users"],
  options: { readonly validateAssignments?: boolean } = {},
): Promise<void> {
  const validateAssignments = options.validateAssignments ?? true;
  const currentUserIds = new Set((await tx.user.findMany()).map((u) => u.id));

  for (const user of users) {
    const reportingGroupId = user.reportingGroupId ?? null;
    const name = composeName({
      lastName: user.lastName,
      firstName: user.firstName,
      middleName: user.middleName,
    });
    if (currentUserIds.has(user.id)) {
      if (validateAssignments) {
        await lockUserAndAssertActivityAssignments(tx, {
          userId: user.id,
          role: user.role,
          reportingGroupId,
        });
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: user.email,
          name,
          lastName: user.lastName,
          firstName: user.firstName,
          middleName: user.middleName,
          position: user.position,
          role: user.role,
          reportingGroupId,
          isActive: user.isActive,
        },
      });
    } else {
      await tx.user.create({
        data: {
          id: user.id,
          email: user.email,
          name,
          lastName: user.lastName,
          firstName: user.firstName,
          middleName: user.middleName,
          position: user.position,
          role: user.role,
          samlId: user.email,
          reportingGroupId,
          isActive: user.isActive,
        },
      });
    }
  }
}
