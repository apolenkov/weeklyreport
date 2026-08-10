import type { ReactNode } from "react";

import { HEAD_ROUTE_ROLES } from "../../../shared/model/route-role-policy";
import { RoleGate } from "../../../shared/ui/auth-runtime/role-gate";

type Props = Readonly<{ children: ReactNode }>;

export default function HeadLayout({ children }: Props) {
  return <RoleGate allowedRoles={HEAD_ROUTE_ROLES}>{children}</RoleGate>;
}
