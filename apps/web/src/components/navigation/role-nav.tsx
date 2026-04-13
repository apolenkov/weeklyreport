'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  FileStack,
  FileText,
  History,
  LayoutDashboard,
  Settings,
} from 'lucide-react';

import type { Role } from '@customreport/shared';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@customreport/ui';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

const navItems: NavItem[] = [
  {
    href: '/lead/report',
    label: 'My Report',
    icon: FileText,
    roles: ['lead'],
  },
  {
    href: '/head/dashboard',
    label: 'Review Dashboard',
    icon: LayoutDashboard,
    roles: ['head'],
  },
  {
    href: '/head/report',
    label: 'Assembled Report',
    icon: FileStack,
    roles: ['head'],
  },
  {
    href: '/reports/:reportId',
    label: 'Published Report',
    icon: BookOpen,
    roles: ['head', 'viewer'],
  },
  {
    href: '/reports/history',
    label: 'Report History',
    icon: History,
    roles: ['head', 'viewer'],
  },
  {
    href: '/admin',
    label: 'Admin',
    icon: Settings,
    roles: ['head'],
  },
];

type RoleNavProps = {
  readonly activeReportId?: string | null;
  readonly role: Role;
  readonly currentPath: string;
};

export function RoleNav({ activeReportId = null, role, currentPath }: RoleNavProps) {
  const visibleItems = navItems
    .filter((item) => item.roles.includes(role))
    .filter((item) => item.href !== '/reports/:reportId' || Boolean(activeReportId))
    .map((item) => ({
      ...item,
      href:
        item.href === '/reports/:reportId' && activeReportId
          ? `/reports/${activeReportId}`
          : item.href,
    }));

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.href;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                  <Link href={item.href}>
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export { navItems };
export type { NavItem };
