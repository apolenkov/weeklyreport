import type { Role } from "@customreport/shared";
import type { ReactNode } from "react";

import { RoleGate } from "../../../components/role-gate";

/**
 * AUTH-07 (Phase 29-03): SSR role gate for /reports/* routes.
 *
 * Any-authenticated-role surface — heads, leads, admins, and viewers all
 * read this surface but with different row visibility (Phase 28-01:
 * archive.list / weeklyReport.get scope by ctx.session.role at the
 * service layer). The layout's job is only to deny anonymous traffic;
 * the service-layer filter is the actual security boundary.
 */
const REQUIRED: readonly Role[] = ["lead", "head", "admin", "viewer"];

type Props = Readonly<{ children: ReactNode }>;

export default function ReportsLayout({ children }: Props) {
  return <RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>;
}
