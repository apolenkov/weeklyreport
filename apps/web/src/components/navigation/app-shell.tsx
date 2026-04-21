'use client';

import type { ReactNode } from 'react';

import type { Role } from '@customreport/shared';

import {
  Separator,
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
import { RoleNav, navItems } from './role-nav';

type AppShellProps = {
  readonly activeReportId?: string | null;
  readonly role: Role;
  readonly currentPath: string;
  readonly userName?: string;
  readonly children: ReactNode;
};

function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    lead: 'Lead',
    head: 'Head',
    viewer: 'Viewer',
  };
  return labels[role];
}

function getPageTitle(currentPath: string, activeReportId: string | null): string {
  const match = navItems.find((item) => {
    const href = item.href === '/reports/:reportId' && activeReportId
      ? `/reports/${activeReportId}`
      : item.href;
    return href === currentPath;
  });
  return match?.label ?? 'Page';
}

export function AppShell({
  activeReportId = null,
  role,
  currentPath,
  userName = 'User',
  children,
}: AppShellProps) {
  const pageTitle = getPageTitle(currentPath, activeReportId);

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
        <div className="px-4 group-data-[collapsible=icon]:px-2">
          <Separator className="bg-sidebar-border" />
        </div>
        <SidebarContent className="px-2 py-3">
          <RoleNav activeReportId={activeReportId} role={role} currentPath={currentPath} />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-2 group-data-[collapsible=icon]:px-2">
          <SidebarTrigger className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/80 px-6 backdrop-blur-md">
          <MobileNav activeReportId={activeReportId} role={role} currentPath={currentPath} />
          <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-sm lg:flex">
            <span className="text-muted-foreground">{getRoleLabel(role)}</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="text-base font-semibold">{pageTitle}</span>
          </nav>
          <div className="flex-1" />
          <NavUser userName={userName} userRole={role} />
        </header>
        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-[1200px] animate-fade-in">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
