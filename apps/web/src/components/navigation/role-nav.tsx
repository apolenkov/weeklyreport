import React from 'react';

import type { Role } from '@customreport/shared';

type RoleNavProps = {
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
];

export function RoleNav({ role, currentPath }: RoleNavProps) {
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

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
