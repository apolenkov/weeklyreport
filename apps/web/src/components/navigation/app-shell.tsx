import React from 'react';
import type { ReactNode } from 'react';

import type { Role } from '@customreport/shared';

import { RoleNav } from './role-nav';

void React;

type AppShellProps = {
  role: Role;
  currentPath: string;
  children: ReactNode;
};

export function AppShell({ role, currentPath, children }: AppShellProps) {
  return (
    <div>
      <RoleNav role={role} currentPath={currentPath} />
      <main>{children}</main>
    </div>
  );
}
