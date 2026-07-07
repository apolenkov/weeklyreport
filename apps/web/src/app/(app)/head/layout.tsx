import type { Role } from "@customreport/shared";
import type { ReactNode } from "react";

import { RoleGate } from "../../../shared/ui/role-gate";

/**
 * SSR role gate for /head/* routes.
 *
 * Mirrors the api's headProcedure — only roles that act as head pass the
 * gate. admin is included because adminProcedure === headProcedure.
 */
const REQUIRED: readonly Role[] = ["head", "admin"];

type Props = Readonly<{ children: ReactNode }>;

export default function HeadLayout({ children }: Props) {
  return <RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>;
}
