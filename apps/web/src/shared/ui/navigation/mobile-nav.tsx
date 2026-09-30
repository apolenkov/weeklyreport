"use client";

import type { Role } from "@customreport/shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@customreport/ui/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";

import { MobileNavLinks } from "./mobile-nav-links";
import type { NavLink } from "./nav-links";

export function MobileNav({
  links,
  pathname,
  role,
}: {
  readonly links: readonly NavLink[];
  readonly pathname: string;
  readonly role: Role | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center border-t border-[var(--color-border)] px-4 py-2 sm:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
          aria-label="Open navigation menu"
        >
          <Menu size={20} aria-hidden="true" />
          <span>Menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-[var(--color-border)] p-4">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <MobileNavLinks
            links={links}
            pathname={pathname}
            role={role}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
