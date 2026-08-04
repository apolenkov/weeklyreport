"use client";

import { sessionRoleSchema } from "@customreport/shared";
import { Skeleton } from "@customreport/ui/components/ui/skeleton";

import { type LastRoleRecord } from "../lib/last-role";
import {
  DEV_EMAIL_FOR_ROLE,
  devLoginHref,
  ROLE_LABEL,
} from "./login-page-roles";

const LOGIN_HAIRLINE_CLASSNAME = "border-[var(--color-border-warm)]";

// Shared min-height (~role-picker height) so AUTH_STUB card swaps do not CLS.
const STUB_CARD_CLASSNAME = `min-h-[113px] rounded-md border ${LOGIN_HAIRLINE_CLASSNAME} bg-[var(--color-surface-empty)] px-3 py-2.5 text-left`;

const PRIMARY_CTA_MIN_HEIGHT = "52px";

function RoleOptionsList() {
  return (
    <ul
      className="mt-2 grid grid-cols-2 gap-1.5"
      data-testid="last-role-switcher"
    >
      {sessionRoleSchema.options.map((role) => (
        <li key={role}>
          <a
            href={devLoginHref(role, DEV_EMAIL_FOR_ROLE[role])}
            className={`block rounded border ${LOGIN_HAIRLINE_CLASSNAME} bg-[var(--color-card)] px-2 py-1.5 text-center text-xs font-semibold text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)]`}
            data-testid={`last-role-option-${role}`}
          >
            {ROLE_LABEL[role]}
          </a>
        </li>
      ))}
    </ul>
  );
}

interface PrimaryCtaProps {
  readonly authStub: boolean;
  readonly lastRole: LastRoleRecord | null;
  readonly ssoHref: string;
}

export function PrimaryCta({ authStub, lastRole, ssoHref }: PrimaryCtaProps) {
  return (
    <a
      href={
        authStub
          ? lastRole
            ? devLoginHref(lastRole.role, lastRole.email)
            : devLoginHref("admin", DEV_EMAIL_FOR_ROLE.admin)
          : ssoHref
      }
      className="flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-4 font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary-foreground)] transition-[background-color,opacity,transform] hover:bg-[var(--color-primary)] hover:-translate-y-px active:translate-y-0 active:opacity-90"
      style={{
        minHeight: PRIMARY_CTA_MIN_HEIGHT,
        boxShadow: "var(--shadow-primary-cta)",
      }}
      aria-label={
        authStub
          ? lastRole
            ? `Enter application as ${lastRole.name} (${ROLE_LABEL[lastRole.role]})`
            : "Enter application as admin"
          : "Sign in with corporate SSO"
      }
      data-testid="primary-cta"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
      {authStub ? "Enter Application" : "Sign in with SSO"}
    </a>
  );
}

interface LastRoleCardProps {
  readonly lastRoleLoaded: boolean;
  readonly lastRole: LastRoleRecord | null;
}

// Fixed height via STUB_CARD_CLASSNAME: no collapse CLS; always a role path.
export function LastRoleCard({ lastRoleLoaded, lastRole }: LastRoleCardProps) {
  return !lastRoleLoaded ? (
    <div
      className={STUB_CARD_CLASSNAME}
      data-testid="last-role-hint-skeleton"
      aria-hidden="true"
    >
      <Skeleton className="h-3.5 w-40" />
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {sessionRoleSchema.options.map((role) => (
          <Skeleton key={role} className="h-[30px] rounded" />
        ))}
      </div>
    </div>
  ) : lastRole ? (
    <div className={STUB_CARD_CLASSNAME} data-testid="last-role-hint">
      <p className="text-xs leading-snug text-[var(--color-muted-foreground)]">
        Last session:{" "}
        <span className="font-semibold text-[var(--color-foreground)]">
          {lastRole.name}
        </span>{" "}
        · {ROLE_LABEL[lastRole.role]}
      </p>
      <RoleOptionsList />
    </div>
  ) : (
    <div className={STUB_CARD_CLASSNAME} data-testid="role-picker">
      <p className="text-xs leading-snug text-[var(--color-muted-foreground)]">
        Enter as a specific role:
      </p>
      <RoleOptionsList />
    </div>
  );
}
