import type { ReactNode } from "react";

import { VIEWER_STATUS_ROUTE_ROLES } from "../../../../shared/model/route-role-policy";
import { RoleGate } from "../../../../shared/ui/auth-runtime/role-gate";

type Props = Readonly<{ children: ReactNode }>;

export default function ReportsLatestLayout({ children }: Props) {
  return (
    <RoleGate allowedRoles={VIEWER_STATUS_ROUTE_ROLES}>{children}</RoleGate>
  );
}
