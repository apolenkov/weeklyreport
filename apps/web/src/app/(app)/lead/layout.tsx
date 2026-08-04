import type { ReactNode } from "react";

import { LEAD_ROUTE_ROLES } from "../../../shared/model/route-role-policy";
import { RoleGate } from "../../../shared/ui/role-gate";

type Props = Readonly<{ children: ReactNode }>;

export default function LeadLayout({ children }: Props) {
  return <RoleGate allowedRoles={LEAD_ROUTE_ROLES}>{children}</RoleGate>;
}
