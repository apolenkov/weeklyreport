"use client";

import { DEFAULT_ORGANIZATION_IDENTITY, type Role } from "@customreport/shared";
import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@customreport/ui/components/ui/sheet";
import {
  BarChart3,
  Clock,
  FileText,
  Globe2,
  LayoutDashboard,
  Moon,
  Presentation,
  Settings,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { roleHomePath } from "../../lib/role-home";
import { useSession } from "../../lib/session-provider";
import { DevRoleSwitcher } from "../dev/role-switcher";

interface NavLink {
  href: string;
  label: string;
  title?: string;
  // Roles that should SEE this link in nav. Tighter than route-access
  // (head/admin can technically open /lead/report but should not see it
  // in their nav — lead-prefix routes are personal lead data, head has
  // their own dashboard for the same intent).
  roles: readonly Role[];
}

const NAV_LINKS: readonly NavLink[] = [
  { href: "/lead/report", label: "Report", roles: ["lead"] },
  // UX-17 (Phase 35-08): one History page for both active and archived
  // report periods; archived visibility is toggled inside the page.
  {
    href: "/reports?tab=drafts",
    label: "History",
    title: "Past weeks and closed reports",
    roles: ["lead"],
  },
  // UAT 2026-05-22: /head/history now 307-redirects to /reports?tab=published
  // (same surface as viewer). Nav link points directly to the destination.
  {
    href: "/reports?tab=published",
    label: "History",
    title: "Past weeks and closed reports",
    roles: ["head"],
  },
  {
    href: "/reports?tab=published",
    label: "History",
    title: "Past weeks and closed reports",
    roles: ["viewer"],
  },
  { href: "/head/dashboard", label: "Dashboard", roles: ["head"] },
  { href: "/head/report", label: "Status", roles: ["head"] },
  // T-F4-3 (plan §22.9): Slides removed from head nav — slides is a mode
  // toggle inside Status/History, not a separate destination. The
  // /head/slides URL still redirects to /head/history?mode=slides
  // (back-compat in head/slides/page.tsx).
  // UFB-038: admin tab is admin-only. heads have a dashboard, not an admin
  // panel. The /admin/layout.tsx role gate enforces the same on the route.
  { href: "/admin", label: "Admin", roles: ["admin"] },
];

const USER_IDENTITY_SLOT_CLASS =
  "hidden h-8 min-w-0 max-w-[260px] flex-col justify-center xl:flex";
const BRAND_SLOT_CLASS = "flex w-10 shrink-0 items-center justify-center py-4";
const RIGHT_RAIL_CLASS =
  "relative flex items-center justify-end gap-2.5 justify-self-end xl:w-[272px]";
const LOGOUT_BUTTON_CLASS =
  "inline-flex h-8 w-10 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-0 text-[12px] font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-foreground)]";

function getRoleLabel(role: Role): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "head":
      return "Group Head";
    case "lead":
      return "Lead";
    case "viewer":
      return "Viewer";
  }
}

function reportsTabFromHref(href: string): string | null {
  const [, query = ""] = href.split("?");
  return new URLSearchParams(query).get("tab");
}

function isPublishedReportPath(pathname: string): boolean {
  return (
    pathname === "/reports/history" ||
    /^\/reports\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:\/present)?$/.test(
      pathname,
    )
  );
}

function isActiveLink(
  pathname: string,
  activeReportsTab: string | null,
  href: string,
): boolean {
  if (href === "/admin") return pathname.startsWith("/admin");
  if (href === "/head/report") return pathname.startsWith("/head/report");
  if (href === "/head/dashboard") return pathname === "/head/dashboard";
  if (href.startsWith("/reports?")) {
    const hrefTab = reportsTabFromHref(href);
    if (pathname === "/reports") {
      return (
        activeReportsTab === hrefTab ||
        (hrefTab === "drafts" && activeReportsTab === "published")
      );
    }
    return (
      isPublishedReportPath(pathname) &&
      (hrefTab === "published" || hrefTab === "drafts")
    );
  }
  return pathname.startsWith(href);
}

// UFB-044: per-role home is now centralised in `lib/role-home.ts` and
// reused by the dev-login redirect (UFB-034). Previously admin and head
// both pointed at `/head/dashboard`, which sent admin sessions into the
// head dashboard — see UFB-044 backlog entry for the user-reported flow.
const getLogoHref = roleHomePath;

function subscribeHydrationStore() {
  return () => undefined;
}

function useHydratedClient(): boolean {
  return useSyncExternalStore(
    subscribeHydrationStore,
    () => true,
    () => false,
  );
}

// Initials helper — first char of first word + first char of last word;
// single-word names fall back to the first 2 chars.
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "??";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

function LanguageComingSoonControl() {
  // TODO(i18n-future): replace this inert control with a real locale switch
  // when the dedicated i18n phase introduces dictionaries and routing.
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        aria-disabled="true"
        aria-label="Language selection is coming soon"
        title="Coming Soon"
        data-testid="language-coming-soon"
        className="inline-flex h-8 w-10 cursor-default items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] px-0 text-[12px] font-semibold text-[var(--color-muted-foreground)]"
      >
        <Globe2 size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <ComingSoonBadge
        role="tooltip"
        className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-30 opacity-0 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.08)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      />
    </div>
  );
}

function ThemeComingSoonControl() {
  // TODO(UFB-074): replace this inert control with a real theme switch only
  // after .planning/todos/pending/2026-05-14-future-ui-telemetry-coming-soon.md
  // is promoted into a new milestone.
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        aria-disabled="true"
        aria-label="Theme selection is coming soon"
        title="Coming Soon"
        data-testid="theme-coming-soon"
        className="inline-flex h-8 w-10 cursor-default items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] px-0 text-[12px] font-semibold text-[var(--color-muted-foreground)]"
      >
        <Moon size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <ComingSoonBadge
        role="tooltip"
        className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-30 opacity-0 shadow-[0_8px_18px_-14px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.08)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      />
    </div>
  );
}

function shouldRenderDevRoleSwitcher() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_ROLE_SWITCHER === "true"
  );
}

function NavIcon({ href }: { readonly href: string }) {
  const common = { size: 14, strokeWidth: 2, "aria-hidden": true };
  switch (href) {
    case "/lead/report":
      return <FileText {...common} />;
    case "/reports?tab=drafts":
    case "/reports?tab=published":
      return <Clock {...common} />;
    case "/head/dashboard":
      return <LayoutDashboard {...common} />;
    case "/head/report":
      return <BarChart3 {...common} />;
    case "/head/slides":
      return <Presentation {...common} />;
    case "/admin":
      return <Settings {...common} />;
    default:
      return null;
  }
}

export function NavBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, organization, isLoading: sessionLoading } = useSession();
  const hydrated = useHydratedClient();
  const activeReportsTab = searchParams.get("tab") ?? null;

  const visibleUser = hydrated ? user : null;
  const visibleOrganization = hydrated ? organization : null;
  const visibleSessionLoading = sessionLoading || !hydrated;

  const role: Role | null = visibleUser?.role ?? null;
  const visibleLinks: readonly NavLink[] =
    role === null ? [] : NAV_LINKS.filter((link) => link.roles.includes(role));

  const initials = visibleUser ? initialsFromName(visibleUser.name) : "?";
  const roleLabel = role ? getRoleLabel(role) : "";
  // UFB-066 (2026-05-11): show a skeleton placeholder for the brand pill
  // while the session query is in-flight, instead of flashing the
  // DEFAULT_ORGANIZATION_IDENTITY fallback ('ORG') and then swapping to the
  // real tenant brand ('PEO'). The flash was the «ORG → PEO» pop user saw
  // on every cold reload.
  const orgResolved = !visibleSessionLoading && visibleOrganization !== null;
  const orgShortName = orgResolved
    ? visibleOrganization.shortName
    : DEFAULT_ORGANIZATION_IDENTITY.shortName;
  const homeLabel = visibleUser
    ? `${visibleUser.name} home`
    : "Profile loading";
  const identityMeta = [
    orgResolved ? orgShortName : null,
    visibleUser?.reportingGroupName,
    roleLabel,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <header className="w-full bg-[var(--color-card)]" data-testid="nav-bar">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 justify-self-start">
          {/* Home mark — user initials carry identity in the compact left slot;
              organization identity stays textual in the metadata line. */}
          <a
            href={role ? getLogoHref(role) : "/"}
            className={BRAND_SLOT_CLASS}
            aria-label={homeLabel}
          >
            {visibleUser ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-starbucks-accent)] shadow-[0_0_0_1px_rgba(0,98,65,0.08)]">
                <span className="font-[family-name:var(--font-sans)] text-[11px] font-bold leading-none tracking-normal text-white">
                  {initials}
                </span>
              </div>
            ) : (
              <>
                {/* UFB-066: brand skeleton until session.organization resolves.
                    Uses the same fixed brand slot as the resolved logo so
                    the nav center line stays still while auth hydrates. */}
                <div
                  className="h-8 w-8 shrink-0 rounded-full bg-[var(--color-muted)]/40"
                  aria-hidden="true"
                />
              </>
            )}
          </a>

          {visibleSessionLoading ? (
            <div className={USER_IDENTITY_SLOT_CLASS} aria-hidden="true">
              <div className="h-3 w-28 rounded bg-[var(--color-muted)]/40" />
              <div className="mt-1 h-2.5 w-16 rounded bg-[var(--color-muted)]/30" />
            </div>
          ) : (
            visibleUser && (
              <div
                className={USER_IDENTITY_SLOT_CLASS}
                data-testid="nav-identity"
              >
                <span className="min-w-0 max-w-full truncate whitespace-nowrap text-[13px] leading-4 text-[var(--color-foreground)]">
                  <span className="font-semibold">{visibleUser.name}</span>
                </span>
                <span className="min-w-0 max-w-full truncate whitespace-nowrap text-[10px] font-semibold uppercase leading-3 tracking-normal text-[var(--color-muted-foreground)]">
                  {identityMeta}
                </span>
              </div>
            )
          )}
        </div>

        {/* Navigation — N-2: pill active state, N-3: per-link icon.
            whitespace-nowrap on each pill prevents wrapping when the
            right-rail period+avatar squeeze the available width. */}
        <nav
          aria-label="Main navigation"
          className="hidden sm:flex sm:items-center sm:gap-0.5"
        >
          {visibleLinks.map((link) => {
            const active = isActiveLink(pathname, activeReportsTab, link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                title={link.title}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-1.5 text-[13px] transition-colors ${
                  active
                    ? "bg-[var(--color-success)] font-semibold text-[var(--color-starbucks-accent)]"
                    : "font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <NavIcon href={link.href} />
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Right rail. Identity now lives in the left home mark + xl text:
            the rail keeps only actions so the center nav has stable space.
            UFB-NEW-A1: show skeleton placeholders while session is loading so
            the header width is stable from first paint → zero CLS on reload.
            Language, Theme and Logout stay grouped as the action rail. */}
        <div className={RIGHT_RAIL_CLASS}>
          {visibleSessionLoading ? (
            <>
              <div
                className="h-8 w-10 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40 xl:w-[92px]"
                aria-hidden="true"
              />
              <div
                className="h-8 w-10 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40"
                aria-hidden="true"
              />
              <div
                className="h-8 w-10 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40"
                aria-hidden="true"
              />
            </>
          ) : (
            <>
              {shouldRenderDevRoleSwitcher() && <DevRoleSwitcher />}
              <ThemeComingSoonControl />
              <LanguageComingSoonControl />
              {visibleUser && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch("/auth/logout", {
                        method: "POST",
                        credentials: "include",
                      });
                    } finally {
                      window.location.href = "/";
                    }
                  }}
                  data-testid="nav-logout"
                  aria-label="Sign out"
                  title="Sign out"
                  className={LOGOUT_BUTTON_CLASS}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Teal bottom accent — N-6: 3px tealA, rounded top corners. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="h-[3px] rounded-t bg-[var(--color-starbucks-accent)]" />
      </div>

      <MobileNav
        links={visibleLinks}
        pathname={pathname}
        activeReportsTab={activeReportsTab}
        role={role}
      />
    </header>
  );
}

// ---- Mobile navigation ----

function MobileNav({
  links,
  pathname,
  activeReportsTab,
  role,
}: {
  readonly links: readonly NavLink[];
  readonly pathname: string;
  readonly activeReportsTab: string | null;
  readonly role: Role | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-2 sm:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-md text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
          aria-label="Open navigation menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span className="sr-only">Menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-[var(--color-border)] p-4">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav aria-label="Mobile navigation" className="flex flex-col p-2">
            {links.map((link) => {
              const active = isActiveLink(
                pathname,
                activeReportsTab,
                link.href,
              );
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-success)] text-[var(--color-starbucks-accent)]"
                      : "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon href={link.href} />
                  {link.label}
                </a>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
      {role && (
        <span className="text-[10px] text-[var(--color-muted-foreground)]">
          {getRoleLabel(role)}
        </span>
      )}
    </div>
  );
}
