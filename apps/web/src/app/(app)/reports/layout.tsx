import type { ReactNode } from "react";

import { REPORTS_ROUTE_ROLES } from "../../../shared/model/route-role-policy";
import { RoleGate } from "../../../shared/ui/role-gate";

type Props = Readonly<{ children: ReactNode }>;

export default function ReportsLayout({ children }: Props) {
  return <RoleGate allowedRoles={REPORTS_ROUTE_ROLES}>{children}</RoleGate>;
}
