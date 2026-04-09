import React from 'react';

import type { Role } from '@customreport/shared';

type RoleNavProps = {
  activeReportId?: string | null;
  role: Role;
  currentPath: string;
};

type NavItem = {
  href: string;
  label: string;
  roles: Role[];
};

void React;

const navItems: NavItem[] = [
  {
    href: '/lead/report',
    label: 'My Report',
    roles: ['lead'],
  },
  {
    href: '/head/dashboard',
    label: 'Review Dashboard',
    roles: ['head'],
  },
  {
    href: '/head/report',
    label: 'Assembled Report',
    roles: ['head'],
  },
  {
    href: '/reports/:reportId',
    label: 'Published Report',
    roles: ['head', 'viewer'],
  },
  {
    href: '/reports/history',
    label: 'Report History',
    roles: ['head', 'viewer'],
  },
  {
    href: '/admin',
    label: 'Admin',
    roles: ['head'],
  },
];

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
    <nav aria-label="Primary">
      <ul>
        {visibleItems.map((item) => (
          <li key={item.href}>
            <a
              aria-current={currentPath === item.href ? 'page' : undefined}
              href={item.href}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
