import { type Role, ROLE_LABEL } from "@customreport/shared";

import { getLogoHref } from "./nav-active";

const USER_IDENTITY_SLOT_CLASS =
  "flex min-w-0 max-w-[260px] flex-col justify-center py-3";
const BRAND_SLOT_CLASS = "flex w-10 shrink-0 items-center justify-center py-4";

// Initials link home; the adjacent name and role identify the session.
function BrandMark({
  role,
  homeLabel,
  initials,
  userName,
}: {
  readonly role: Role | null;
  readonly homeLabel: string;
  readonly initials: string;
  readonly userName: string | null;
}) {
  return (
    <a
      href={role ? getLogoHref(role) : "/"}
      className={BRAND_SLOT_CLASS}
      aria-label={homeLabel}
    >
      {userName !== null ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-starbucks-accent)] shadow-[var(--shadow-brand-mark)]">
          <span className="font-[family-name:var(--font-sans)] text-xs font-bold leading-none tracking-normal text-[var(--color-on-dark)]">
            {initials}
          </span>
        </div>
      ) : (
        <div
          className="h-8 w-8 shrink-0 rounded-full bg-[var(--color-muted)]/40"
          aria-hidden="true"
        />
      )}
    </a>
  );
}

function IdentitySlot({
  role,
  userName,
  identityMeta,
  sessionLoading,
}: {
  readonly role: Role | null;
  readonly userName: string | null;
  readonly identityMeta: string;
  readonly sessionLoading: boolean;
}) {
  if (sessionLoading) {
    return (
      <div className={USER_IDENTITY_SLOT_CLASS} aria-hidden="true">
        <div className="h-3 w-28 rounded bg-[var(--color-muted)]/40" />
        <div className="mt-1 h-2.5 w-16 rounded bg-[var(--color-muted)]/30" />
      </div>
    );
  }
  if (userName === null) return null;
  return (
    <div className={USER_IDENTITY_SLOT_CLASS} data-testid="nav-identity">
      <span className="min-w-0 max-w-full text-[13px] leading-4 text-[var(--color-foreground)] [overflow-wrap:anywhere]">
        <span className="font-semibold">{userName}</span>
      </span>
      {role && (
        <span className="text-xs font-semibold text-[var(--color-muted-foreground)] md:hidden">
          {ROLE_LABEL[role]}
        </span>
      )}
      <span className="hidden min-w-0 max-w-full truncate whitespace-nowrap text-xs font-semibold leading-4 text-[var(--color-muted-foreground)] md:block">
        {identityMeta}
      </span>
    </div>
  );
}

export function NavBrand({
  role,
  homeLabel,
  initials,
  userName,
  identityMeta,
  sessionLoading,
}: {
  readonly role: Role | null;
  readonly homeLabel: string;
  readonly initials: string;
  readonly userName: string | null;
  readonly identityMeta: string;
  readonly sessionLoading: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 justify-self-start">
      <BrandMark
        role={role}
        homeLabel={homeLabel}
        initials={initials}
        userName={userName}
      />
      <IdentitySlot
        role={role}
        userName={userName}
        identityMeta={identityMeta}
        sessionLoading={sessionLoading}
      />
    </div>
  );
}
