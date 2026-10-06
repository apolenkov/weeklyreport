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
import { NAV_RAIL_BUTTON_CLASS } from "./nav-logout-button";

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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={`${NAV_RAIL_BUTTON_CLASS} sm:hidden`}
        aria-label="Open navigation menu"
        title="Menu"
      >
        <Menu size={16} aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0">
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
  );
}
