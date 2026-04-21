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
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@customreport/ui';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  group: string;
};

const navItems: NavItem[] = [
  {
    href: '/lead/report',
    label: 'My Report',
    icon: FileText,
    roles: ['lead'],
    group: 'Reports',
  },
  {
    href: '/lead/history',
    label: 'My History',
    icon: History,
    roles: ['lead'],
    group: 'Reports',
  },
  {
    href: '/head/dashboard',
    label: 'Review Dashboard',
    icon: LayoutDashboard,
    roles: ['head'],
    group: 'Reports',
  },
  {
    href: '/head/report',
    label: 'Assembled Report',
    icon: FileStack,
    roles: ['head'],
    group: 'Reports',
  },
  {
    href: '/reports/:reportId',
    label: 'Published Report',
    icon: BookOpen,
    roles: ['head', 'viewer'],
    group: 'Reports',
  },
  {
    href: '/reports/history',
    label: 'Report History',
    icon: History,
    roles: ['head', 'viewer'],
    group: 'Reports',
  },
  {
    href: '/admin',
    label: 'Admin',
    icon: Settings,
    roles: ['head'],
    group: 'Administration',
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

  const grouped = visibleItems.reduce<Record<string, typeof visibleItems>>((acc, item) => {
    const group = acc[item.group] ?? [];
    group.push(item);
    acc[item.group] = group;
    return acc;
  }, {});

  return (
    <>
      {Object.entries(grouped).map(([groupName, items]) => (
        <SidebarGroup key={groupName}>
          <SidebarGroupLabel>{groupName}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
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
      ))}
    </>
  );
}

export { navItems };
export type { NavItem };
