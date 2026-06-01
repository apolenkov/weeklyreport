import type { Role } from "@customreport/shared";
import type { ReactNode } from "react";

import { ForbiddenPage } from "../../../components/forbidden-page";
import { getServerSession } from "../../../lib/server/get-server-session";

/**
 * AUTH-07 (Phase 29-03): SSR role gate for /lead/* routes.
 *
 * Lead surface excludes viewers — only roles with write access to a
 * weekly section pass. head/admin keep access for impersonation /
 * troubleshooting (matches Phase 28-01's leadProcedure surface).
 */
const REQUIRED: readonly Role[] = ["lead", "head", "admin"];

type Props = Readonly<{ children: ReactNode }>;

export default async function LeadLayout({ children }: Props) {
  const session = await getServerSession();
  if (!session || !REQUIRED.includes(session.role)) {
    return <ForbiddenPage requiredRoles={REQUIRED} />;
  }
  return <>{children}</>;
}
