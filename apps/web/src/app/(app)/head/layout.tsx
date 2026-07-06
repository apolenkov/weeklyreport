import type { Role } from "@customreport/shared";
import type { ReactNode } from "react";

import { RoleGate } from "../../../shared/ui/role-gate";

/**
 * AUTH-07 (Phase 29-03): SSR role gate for /head/* routes.
 *
 * Mirrors the api's headProcedure — only roles that act as head pass the
 * gate. admin is included because adminProcedure === headProcedure for
 * v6.0 (D-AUTH-03).
 */
const REQUIRED: readonly Role[] = ["head", "admin"];

type Props = Readonly<{ children: ReactNode }>;

export default function HeadLayout({ children }: Props) {
  return <RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>;
}
