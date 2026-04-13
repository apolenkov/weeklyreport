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
  Separator,
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
      <Sidebar collapsible="icon" className="border-r border-sidebar-border" aria-label="Main navigation">
        <SidebarHeader className="flex items-center gap-3 px-4 py-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary font-semibold text-sidebar-primary-foreground text-sm">
            CR
          </div>
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            CustomReport
          </span>
        </SidebarHeader>
        <Separator className="mx-4 w-auto bg-sidebar-border" />
        <SidebarContent className="px-2 py-3">
          <RoleNav activeReportId={activeReportId} role={role} currentPath={currentPath} />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-2 group-data-[collapsible=icon]:px-0">
          <SidebarTrigger className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur-md">
          <MobileNav activeReportId={activeReportId} role={role} currentPath={currentPath} />
          <div className="flex-1" />
          <NavUser userName={userName} userRole={role} />
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <div className="mx-auto max-w-[1200px] animate-fade-in">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
