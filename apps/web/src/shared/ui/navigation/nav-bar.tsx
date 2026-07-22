"use client";

import {
  DEFAULT_ORGANIZATION_IDENTITY,
  initials as deriveInitials,
  type Role,
  ROLE_HOME_PATH,
  ROLE_LABEL,
} from "@customreport/shared";
import { ComingSoonIconButton } from "@customreport/ui/components/coming-soon-control";
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
  Settings,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { isViewer } from "../../../lib/role-predicates";
import { useSession } from "../../../lib/session-provider";
import { webEnv } from "../../../lib/web-env";
import { DevRoleSwitcher } from "../role-switcher";

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

const HISTORY_LINK_TITLE = "Past weeks and closed reports";
const REPORTS_LATEST_ROUTE = "/reports/latest";
const HEAD_DASHBOARD_ROUTE = "/head/dashboard";
const HEAD_REPORT_ROUTE = "/head/report";

const NAV_LINKS: readonly NavLink[] = [
  { href: "/lead/report", label: "Report", roles: ["lead"] },
  // One History page for both active and archived report periods; archived
  // visibility is a local toggle inside the page. The link targets bare
  // `/reports` — the page does not read a `tab` query param.
  {
    href: "/reports",
    label: "History",
    title: HISTORY_LINK_TITLE,
    roles: ["lead"],
  },
  // /head/history 307-redirects to /reports (same surface as viewer). The
  // nav link points directly to the destination.
  {
    href: "/reports",
    label: "History",
    title: HISTORY_LINK_TITLE,
    roles: ["head"],
  },
  // viewer-live-status: the viewer is a status observer of the
  // current period. The entry resolves the Status target (the current editable
  // period, else the latest visible published report) via the static
  // `/reports/latest` route, which redirects to the resolved report.
  {
    href: REPORTS_LATEST_ROUTE,
    label: "Status",
    title: "Open the current status report",
    roles: ["viewer"],
  },
  {
    href: "/reports",
    label: "History",
    title: HISTORY_LINK_TITLE,
    roles: ["viewer"],
  },
  { href: HEAD_DASHBOARD_ROUTE, label: "Dashboard", roles: ["head"] },
  { href: HEAD_REPORT_ROUTE, label: "Status", roles: ["head"] },
  // Slides is a mode toggle inside Status/History, not a separate nav
  // destination. The legacy /head/slides URL still redirects to /reports
  // (back-compat in head/slides/page.tsx).
  // admin tab is admin-only. heads have a dashboard, not an admin panel.
  // The /admin/layout.tsx role gate enforces the same on the route.
  { href: "/admin", label: "Admin", roles: ["admin"] },
];

const USER_IDENTITY_SLOT_CLASS =
  "hidden h-8 min-w-0 max-w-[260px] flex-col justify-center xl:flex";
const BRAND_SLOT_CLASS = "flex w-10 shrink-0 items-center justify-center py-4";
const RIGHT_RAIL_CLASS =
  "relative flex items-center justify-end gap-2.5 justify-self-end xl:w-[272px]";
const LOGOUT_BUTTON_CLASS =
  "inline-flex h-8 w-10 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-0 text-[12px] font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-foreground)]";

function isReportDetailPath(pathname: string): boolean {
  return /^\/reports\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    pathname,
  );
}

function isPublishedReportPath(pathname: string): boolean {
  return pathname === "/reports/history" || isReportDetailPath(pathname);
}

function isActiveLink(
  pathname: string,
  href: string,
  role: Role | null,
): boolean {
  if (href === "/admin") return pathname.startsWith("/admin");
  if (href === HEAD_REPORT_ROUTE) return pathname.startsWith(HEAD_REPORT_ROUTE);
  if (href === HEAD_DASHBOARD_ROUTE) return pathname === HEAD_DASHBOARD_ROUTE;
  // viewer-live-status: the viewer's Status entry (`/reports/latest`) resolves
  // to a `/reports/[id]` detail page, so for a viewer a report detail path must
  // light **Status**, not History — clicking Status and seeing History
  // highlighted is the reported bug. History stays lit only on the bare
  // `/reports` list. Scoped to the viewer so the head/lead History-active
  // contract (lead-history-summary, lit on published-report paths) is untouched.
  if (isViewer(role)) {
    if (href === REPORTS_LATEST_ROUTE) {
      return pathname === REPORTS_LATEST_ROUTE || isReportDetailPath(pathname);
    }
    if (href === "/reports") {
      return pathname === "/reports";
    }
  }
  if (href === "/reports") {
    // History active state is pathname-based only — independent of the archive
    // toggle and of any stray `?tab` param.
    // Exact match (not startsWith) so report subpaths fall through to
    // isPublishedReportPath below rather than this History branch.
    return pathname === "/reports" || isPublishedReportPath(pathname);
  }
  return pathname.startsWith(href);
}

const getLogoHref = (role: Role) => ROLE_HOME_PATH[role];

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

function LanguageComingSoonControl() {
  // TODO(i18n-future): replace this inert control with a real locale switch
  // when the dedicated i18n phase introduces dictionaries and routing.
  return (
    <ComingSoonIconButton
      icon={Globe2}
      shape="nav"
      ariaLabel="Language selection is coming soon"
      testId="language-coming-soon"
    />
  );
}

function ThemeComingSoonControl() {
  // TODO(theme-future): replace this inert control with a real theme switch
  // once theming is promoted into a milestone.
  return (
    <ComingSoonIconButton
      icon={Moon}
      shape="nav"
      ariaLabel="Theme selection is coming soon"
      testId="theme-coming-soon"
    />
  );
}

function shouldRenderDevRoleSwitcher() {
  return webEnv.devRoleSwitcher();
}

function NavIcon({ href }: { readonly href: string }) {
  const common = { size: 14, strokeWidth: 2, "aria-hidden": true };
  switch (href) {
    case "/lead/report":
      return <FileText {...common} />;
    case REPORTS_LATEST_ROUTE:
      return <FileText {...common} />;
    case "/reports":
      return <Clock {...common} />;
    case HEAD_DASHBOARD_ROUTE:
      return <LayoutDashboard {...common} />;
    case HEAD_REPORT_ROUTE:
      return <BarChart3 {...common} />;
    case "/admin":
      return <Settings {...common} />;
    default:
      return null;
  }
}

export function NavBar() {
  const pathname = usePathname();
  const { user, organization, isLoading: sessionLoading } = useSession();
  const hydrated = useHydratedClient();

  const visibleUser = hydrated ? user : null;
  const visibleOrganization = hydrated ? organization : null;
  const visibleSessionLoading = sessionLoading || !hydrated;

  const role: Role | null = visibleUser?.role ?? null;
  const visibleLinks: readonly NavLink[] =
    role === null ? [] : NAV_LINKS.filter((link) => link.roles.includes(role));

  const initials = visibleUser
    ? deriveInitials({
        lastName: visibleUser.lastName,
        firstName: visibleUser.firstName,
        name: visibleUser.name,
      }) || "??"
    : "?";
  const roleLabel = role ? ROLE_LABEL[role] : "";
  // Show a skeleton placeholder for the brand pill while the session query
  // is in-flight, instead of flashing the DEFAULT_ORGANIZATION_IDENTITY
  // fallback ('ORG') and then swapping to the real tenant brand ('Demo'). The
  // flash was the «ORG → Demo» pop user saw on every cold reload.
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
                {/* Brand skeleton until session.organization resolves.
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

        {/* Navigation. whitespace-nowrap on each pill prevents wrapping when
            the right-rail period+avatar squeeze the available width. */}
        <nav
          aria-label="Main navigation"
          className="hidden sm:flex sm:items-center sm:gap-0.5"
        >
          {visibleLinks.map((link) => {
            const active = isActiveLink(pathname, link.href, role);
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

        {/* Right rail. Identity lives in the left home mark + xl text, so the
            rail keeps only actions and the center nav has stable space.
            Skeleton placeholders show while the session is loading so the
            header width is stable from first paint → zero CLS on reload.
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
                  onClick={() => {
                    // Redirect home only after the server confirms logout. A
                    // non-OK response or a rejected request leaves the session
                    // cookie intact, so staying on the page is the honest state.
                    void fetch("/auth/logout", {
                      method: "POST",
                      credentials: "include",
                    }).then((response) => {
                      if (response.ok) window.location.href = "/";
                    });
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

      {/* Teal bottom accent — 3px tealA, rounded top corners. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="h-[3px] rounded-t bg-[var(--color-starbucks-accent)]" />
      </div>

      <MobileNav links={visibleLinks} pathname={pathname} role={role} />
    </header>
  );
}

// ---- Mobile navigation ----

function MobileNav({
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
              const active = isActiveLink(pathname, link.href, role);
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
          {ROLE_LABEL[role]}
        </span>
      )}
    </div>
  );
}
