import type { Role } from "@customreport/shared";

import { getLogoHref } from "./nav-active";

const USER_IDENTITY_SLOT_CLASS =
  "hidden h-8 min-w-0 max-w-[260px] flex-col justify-center xl:flex";
const BRAND_SLOT_CLASS = "flex w-10 shrink-0 items-center justify-center py-4";

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
      {/* Home mark — user initials carry identity in the compact left slot;
          organization identity stays textual in the metadata line. */}
      <a
        href={role ? getLogoHref(role) : "/"}
        className={BRAND_SLOT_CLASS}
        aria-label={homeLabel}
      >
        {userName !== null ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-starbucks-accent)] shadow-[0_0_0_1px_rgba(0,98,65,0.08)]">
            <span className="font-[family-name:var(--font-sans)] text-[11px] font-bold leading-none tracking-normal text-white">
              {initials}
            </span>
          </div>
        ) : (
          <>
            {/* Brand skeleton until userName resolves. Same fixed brand
                slot as the resolved mark so the nav center stays still. */}
            <div
              className="h-8 w-8 shrink-0 rounded-full bg-[var(--color-muted)]/40"
              aria-hidden="true"
            />
          </>
        )}
      </a>

      {sessionLoading ? (
        <div className={USER_IDENTITY_SLOT_CLASS} aria-hidden="true">
          <div className="h-3 w-28 rounded bg-[var(--color-muted)]/40" />
          <div className="mt-1 h-2.5 w-16 rounded bg-[var(--color-muted)]/30" />
        </div>
      ) : (
        userName !== null && (
          <div className={USER_IDENTITY_SLOT_CLASS} data-testid="nav-identity">
            <span className="min-w-0 max-w-full truncate whitespace-nowrap text-[13px] leading-4 text-[var(--color-foreground)]">
              <span className="font-semibold">{userName}</span>
            </span>
            <span className="min-w-0 max-w-full truncate whitespace-nowrap text-[10px] font-semibold uppercase leading-3 tracking-normal text-[var(--color-muted-foreground)]">
              {identityMeta}
            </span>
          </div>
        )
      )}
    </div>
  );
}
