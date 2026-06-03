import type { Role } from "@customreport/shared";
import type { ReactNode } from "react";

import { ForbiddenPage } from "../../../../components/forbidden-page";
import { roleHomePath } from "../../../../lib/role-home";
import { getServerSession } from "../../../../lib/server/get-server-session";

/** Nested role gate for the head weekly-report submission surface. */
const REQUIRED: readonly Role[] = ["head", "admin"];

type Props = Readonly<{ children: ReactNode }>;

export default async function HeadReportLayout({ children }: Props) {
  const session = await getServerSession();
  if (!session || !REQUIRED.includes(session.role)) {
    return (
      <ForbiddenPage
        requiredRoles={REQUIRED}
        homeHref={session ? roleHomePath(session.role) : "/"}
      />
    );
  }
  return children;
}
