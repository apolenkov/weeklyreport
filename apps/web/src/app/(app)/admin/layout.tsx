import type { Role } from "@customreport/shared";
import type { ReactNode } from "react";

import { RoleGate } from "../../../shared/ui/role-gate";

/**
 * SSR role gate for /admin/* routes.
 *
 * Layout-level UX gate — the actual security boundary is the api's role
 * middleware. RoleGate renders ForbiddenPage in-place when the role does
 * not match, so the user never sees admin shell chrome before the tRPC
 * error surfaces.
 *
 * Admin segment is admin-only. Heads have /head/dashboard; the admin panel
 * is not theirs. Both the tRPC adminProcedure middleware and this layout
 * enforce the same gate.
 */
const REQUIRED: readonly Role[] = ["admin"];

type Props = Readonly<{ children: ReactNode }>;

export default function AdminLayout({ children }: Props) {
  return <RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>;
}
