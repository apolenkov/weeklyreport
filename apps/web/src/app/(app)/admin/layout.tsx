import type { Role } from "@customreport/shared";
import type { ReactNode } from "react";

import { RoleGate } from "../../../shared/ui/role-gate";

// Layout UX gate only — api role middleware is the real authz boundary.
const REQUIRED: readonly Role[] = ["admin"];

type Props = Readonly<{ children: ReactNode }>;

export default function AdminLayout({ children }: Props) {
  return <RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>;
}
