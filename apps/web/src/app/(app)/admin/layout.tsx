import type { ReactNode } from "react";

import { ADMIN_ROUTE_ROLES } from "../../../shared/model/route-role-policy";
import { RoleGate } from "../../../shared/ui/role-gate";

type Props = Readonly<{ children: ReactNode }>;

export default function AdminLayout({ children }: Props) {
  return <RoleGate allowedRoles={ADMIN_ROUTE_ROLES}>{children}</RoleGate>;
}
