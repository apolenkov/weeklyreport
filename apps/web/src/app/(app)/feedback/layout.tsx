import type { ReactNode } from "react";

import { webEnv } from "../../../shared/lib/runtime/web-env";
import { RoleGate } from "../../../shared/ui/auth-runtime/role-gate";

type Props = Readonly<{ children: ReactNode }>;

export default function FeedbackLayout({ children }: Props) {
  return (
    <RoleGate allowedRoles={webEnv.productFeedbackInboxRoles()}>
      {children}
    </RoleGate>
  );
}
