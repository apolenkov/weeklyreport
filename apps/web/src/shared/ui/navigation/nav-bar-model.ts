import { type Role, ROLE_LABEL } from "@weeklyreport/shared";

import type { SessionState } from "../../lib/auth/session-provider";
import { initialsFromParts } from "../../lib/format/user-initials";
import { NAV_LINKS, type NavLink } from "./nav-links";

interface NavBarModel {
  readonly role: Role | null;
  readonly visibleLinks: readonly NavLink[];
  readonly initials: string;
  readonly userName: string | null;
  readonly homeLabel: string;
  readonly identityMeta: string;
  readonly sessionLoading: boolean;
}

type SessionUser = SessionState["user"];
type SessionOrganization = SessionState["organization"];

interface VisibleSession {
  readonly user: SessionUser;
  readonly organization: SessionOrganization;
  readonly loading: boolean;
}

function resolveVisibleSession(
  user: SessionUser,
  organization: SessionOrganization,
  sessionLoading: boolean,
  hydrated: boolean,
): VisibleSession {
  return {
    user: hydrated ? user : null,
    organization: hydrated ? organization : null,
    loading: sessionLoading || !hydrated,
  };
}

function linksForRole(
  role: Role | null,
  productFeedbackInboxEnabled: boolean,
): readonly NavLink[] {
  return role === null
    ? []
    : NAV_LINKS.filter(
        (link) =>
          link.roles.includes(role) &&
          (link.feature !== "productFeedback" || productFeedbackInboxEnabled),
      );
}

function initialsForUser(user: SessionUser): string {
  if (!user) return "?";
  return initialsFromParts({
    lastName: user.lastName,
    firstName: user.firstName,
    name: user.name,
  });
}

function buildIdentityMeta(
  organization: SessionOrganization,
  user: SessionUser,
  role: Role | null,
  loading: boolean,
): string {
  const organizationName =
    !loading && organization !== null ? organization.shortName : null;
  const roleLabel = role ? ROLE_LABEL[role] : null;
  return [organizationName, user?.reportingGroupName, roleLabel]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function buildNavBarModel({
  user,
  organization,
  sessionLoading,
  hydrated,
  productFeedbackInboxEnabled = false,
}: {
  readonly user: SessionState["user"];
  readonly organization: SessionState["organization"];
  readonly sessionLoading: boolean;
  readonly hydrated: boolean;
  readonly productFeedbackInboxEnabled?: boolean;
}): NavBarModel {
  const visible = resolveVisibleSession(
    user,
    organization,
    sessionLoading,
    hydrated,
  );
  const role: Role | null = visible.user?.role ?? null;

  return {
    role,
    visibleLinks: linksForRole(role, productFeedbackInboxEnabled),
    initials: initialsForUser(visible.user),
    userName: visible.user?.name ?? null,
    homeLabel: visible.user ? `${visible.user.name} home` : "Profile loading",
    identityMeta: buildIdentityMeta(
      visible.organization,
      visible.user,
      role,
      visible.loading,
    ),
    sessionLoading: visible.loading,
  };
}
