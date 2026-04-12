'use client';

import type { ReactNode } from 'react';

import type { Role } from '@customreport/shared';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@customreport/ui';

import { MobileNav } from './mobile-nav';
import { NavUser } from './nav-user';
import { RoleNav } from './role-nav';

type AppShellProps = {
  readonly activeReportId?: string | null;
  readonly role: Role;
  readonly currentPath: string;
  readonly userName?: string;
  readonly children: ReactNode;
};

export function AppShell({
  activeReportId = null,
  role,
  currentPath,
  userName = 'User',
  children,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r" aria-label="Main navigation">
        <SidebarHeader className="flex items-center px-4 py-3 group-data-[collapsible=icon]:px-2">
          <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">
            CustomReport
          </span>
        </SidebarHeader>
        <SidebarContent>
          <RoleNav activeReportId={activeReportId} role={role} currentPath={currentPath} />
        </SidebarContent>
        <SidebarFooter className="group-data-[collapsible=icon]:px-0">
          <SidebarTrigger className="w-full" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-6">
          <MobileNav activeReportId={activeReportId} role={role} currentPath={currentPath} />
          <div className="flex-1" />
          <NavUser userName={userName} userRole={role} />
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
