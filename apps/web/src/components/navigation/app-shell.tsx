"use client";

import type { ReactNode } from "react";

import { ApiReadinessPlaceholder } from "../common/api-readiness-placeholder";

import type { Role } from "@customreport/shared";

type AppShellProps = {
  readonly activeReportId?: string | null;
  readonly role: Role;
  readonly currentPath: string;
  readonly userName?: string;
  readonly children: ReactNode;
};

function getRoleLabel(role: Role): string {
  // Phase 27 widened `Role` to include 'admin' (sessionRoleSchema). For v6.0,
  // adminProcedure === headProcedure (D-AUTH-03), so admin sessions render
  // identically to head until Phase 29 splits them at the SAML attribute layer.
  const labels: Record<Role, string> = {
    lead: "Lead role",
    head: "Head role",
    viewer: "Viewer role",
    admin: "Admin role",
    // UFB-057 / Phase 57: director label appears in the screen-reader hint
    // alongside the brand mark — distinct token so AT users hear the
    // leadership-audience role unambiguously.
    director: "Director role",
  };

  return labels[role];
}

function getPageTitle(currentPath: string): string {
  const pageTitles: Record<string, string> = {
    "/lead/report": "Lead report",
    "/lead/history": "Lead history",
    "/head/dashboard": "Head dashboard",
    "/head/report": "Assembled report",
    "/reports/history": "Published report history",
    "/reports/:reportId": "Published report",
    "/admin": "Admin",
  };

  return pageTitles[currentPath] ?? "CustomReport";
}

export function AppShell({
  activeReportId = null,
  role,
  currentPath,
}: AppShellProps) {
  const pageTitle = getPageTitle(currentPath);
  const resolvedPath =
    currentPath === "/reports/:reportId" && activeReportId
      ? `/reports/${activeReportId}`
      : currentPath;

  return (
    <main className="min-h-screen bg-background px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <ApiReadinessPlaceholder
          currentPath={resolvedPath}
          pageTitle={pageTitle}
          roleLabel={getRoleLabel(role)}
        />
      </div>
    </main>
  );
}
