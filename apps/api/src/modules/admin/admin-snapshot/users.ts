import {
  type AdminSnapshot,
  composeName,
  normalizeEmail,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { AdminLastAdminError } from "../admin-errors.js";

const countActiveAdmins = (tx: Prisma.TransactionClient): Promise<number> =>
  tx.user.count({ where: { role: "admin", isActive: true } });

export async function upsertUsers(
  tx: Prisma.TransactionClient,
  users: AdminSnapshot["users"],
): Promise<void> {
  const currentUserIds = new Set((await tx.user.findMany()).map((u) => u.id));
  const hadActiveAdmin = (await countActiveAdmins(tx)) > 0;

  for (const user of users) {
    const reportingGroupId = user.reportingGroupId ?? null;
    const name = composeName({
      lastName: user.lastName,
      firstName: user.firstName,
      middleName: user.middleName,
    });
    // Same canonicalization as the live admin write: restore persists the
    // case-insensitive email identity while samlId stays verbatim.
    const email = normalizeEmail(user.email);
    if (currentUserIds.has(user.id)) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email,
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
          email,
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
  // A restore must not strip the last active administrator.
  if (hadActiveAdmin && (await countActiveAdmins(tx)) === 0) {
    throw new AdminLastAdminError(
      "The snapshot would leave no active administrator.",
    );
  }
}
