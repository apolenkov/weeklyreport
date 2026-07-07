import type { Role } from "@customreport/shared";
import type { ReactNode } from "react";

import { RoleGate } from "../../../shared/ui/role-gate";

/**
 * SSR role gate for /lead/* routes.
 *
 * Lead surface excludes viewers — only roles with write access to a
 * weekly section pass. head/admin keep access for impersonation /
 * troubleshooting (matches the api's leadProcedure surface).
 */
const REQUIRED: readonly Role[] = ["lead", "head", "admin"];

type Props = Readonly<{ children: ReactNode }>;

export default function LeadLayout({ children }: Props) {
  return <RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>;
}
