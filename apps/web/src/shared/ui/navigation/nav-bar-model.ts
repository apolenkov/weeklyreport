import { type Role, ROLE_LABEL } from "@customreport/shared";

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

export function buildNavBarModel({
  user,
  organization,
  sessionLoading,
  hydrated,
}: {
  readonly user: SessionState["user"];
  readonly organization: SessionState["organization"];
  readonly sessionLoading: boolean;
  readonly hydrated: boolean;
}): NavBarModel {
  const visibleUser = hydrated ? user : null;
  const visibleOrganization = hydrated ? organization : null;
  const visibleSessionLoading = sessionLoading || !hydrated;

  const role: Role | null = visibleUser?.role ?? null;
  const visibleLinks: readonly NavLink[] =
    role === null ? [] : NAV_LINKS.filter((link) => link.roles.includes(role));

  const initials = visibleUser
    ? initialsFromParts({
        lastName: visibleUser.lastName,
        firstName: visibleUser.firstName,
        name: visibleUser.name,
      })
    : "?";
  const roleLabel = role ? ROLE_LABEL[role] : "";

  // Gate the brand string on a resolved org so the pill shows a skeleton
  // while the session query is in-flight instead of flashing the default
  // 'ORG' identity and popping to the real tenant brand on every cold reload.
  const orgResolved = !visibleSessionLoading && visibleOrganization !== null;
  const identityMeta = [
    orgResolved ? visibleOrganization.shortName : null,
    visibleUser?.reportingGroupName,
    roleLabel,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return {
    role,
    visibleLinks,
    initials,
    userName: visibleUser ? visibleUser.name : null,
    homeLabel: visibleUser ? `${visibleUser.name} home` : "Profile loading",
    identityMeta,
    sessionLoading: visibleSessionLoading,
  };
}
