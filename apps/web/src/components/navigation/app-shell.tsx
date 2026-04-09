import React from 'react';
import type { ReactNode } from 'react';

import type { Role } from '@customreport/shared';

import { RoleNav } from './role-nav';

void React;

type AppShellProps = {
  activeReportId?: string | null;
  role: Role;
  currentPath: string;
  children: ReactNode;
};

export function AppShell({ activeReportId = null, role, currentPath, children }: AppShellProps) {
  return (
    <div>
      <RoleNav activeReportId={activeReportId} role={role} currentPath={currentPath} />
      <main>{children}</main>
    </div>
  );
}
