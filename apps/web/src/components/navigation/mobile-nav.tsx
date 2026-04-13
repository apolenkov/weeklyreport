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
          <SheetHeader className="border-b bg-[oklch(0.22_0.06_260)] px-6 py-5">
            <SheetTitle className="flex items-center gap-3 text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.75_0.15_70)] text-xs font-semibold text-[oklch(0.15_0.03_260)]">
                CR
              </div>
              <span className="text-lg font-semibold">CustomReport</span>
            </SheetTitle>
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
                  className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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
