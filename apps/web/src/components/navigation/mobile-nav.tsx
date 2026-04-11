'use client';

import { useState } from 'react';

import { Menu } from 'lucide-react';

import type { Role } from '@customreport/shared';

import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from '@customreport/ui';

import { navItems } from './role-nav';

type MobileNavProps = {
  readonly activeReportId?: string | null;
  readonly role: Role;
  readonly currentPath: string;
};

export function MobileNav({ activeReportId = null, role, currentPath }: MobileNavProps) {
  const [open, setOpen] = useState(false);

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

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Open navigation menu"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="text-lg font-semibold">CustomReport</SheetTitle>
          </SheetHeader>
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1 p-4">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.href;

              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors min-h-[44px] ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="size-5 shrink-0" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
