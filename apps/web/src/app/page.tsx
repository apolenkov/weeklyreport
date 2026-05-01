'use client';

import { useSearchParams } from 'next/navigation';

const AUTH_STUB = process.env.NEXT_PUBLIC_AUTH_STUB === 'true';
const DEV_ROLE_SWITCHER = process.env.NEXT_PUBLIC_DEV_ROLE_SWITCHER === 'true';

const stubRoles = [
  { label: 'Enter as Lead', redirect: '/lead/report', icon: '📝' },
  { label: 'Enter as Head', redirect: '/head/dashboard', icon: '👔' },
  { label: 'Enter as Admin', redirect: '/admin', icon: '⚙️' },
  { label: 'Enter as Viewer', redirect: '/reports/history', icon: '👁' },
] as const;

// Dev-mode picker: each option hits /auth/dev-login, which issues a real
// JWT cookie via buildUserSession() — i.e. the post-SAML state is reached
// without any Keycloak roundtrip. Mirrors the seed-simple identities so
// the role-switcher widget on (app)/ pages stays consistent with the
// landing page.
const devLoginIdentities = [
  { label: 'Head', role: 'head', email: 'head@customreport.local', icon: '👔' },
  { label: 'Platanov (lead)', role: 'lead', email: 'platanov@customreport.local', icon: '📝' },
  { label: 'Maria (lead)', role: 'lead', email: 'maria@customreport.local', icon: '📝' },
  { label: 'Igor (lead)', role: 'lead', email: 'igor@customreport.local', icon: '📝' },
  { label: 'Admin', role: 'admin', email: 'admin@customreport.local', icon: '⚙️' },
  { label: 'Viewer', role: 'viewer', email: 'viewer@customreport.local', icon: '👁' },
] as const;

const DEFAULT_REDIRECT = '/head/dashboard';

/**
 * Reject open-redirect attempts. The `next` query param must be a same-origin
 * relative path: must start with '/' and must not contain '://' (which would
 * indicate a scheme-relative URL like //evil.com).
 */
function sanitizeNext(value: string | null): string {
  if (!value) return DEFAULT_REDIRECT;
  if (!value.startsWith('/')) return DEFAULT_REDIRECT;
  if (value.includes('://')) return DEFAULT_REDIRECT;
  // Disallow protocol-relative URLs explicitly even though the above check
  // catches '://' — a leading '//' would be parsed by browsers as scheme-
  // relative, so reject anything with two leading slashes.
  if (value.startsWith('//')) return DEFAULT_REDIRECT;
  return value;
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const safeNext = sanitizeNext(searchParams?.get('next') ?? null);
  const ssoHref =
    safeNext === DEFAULT_REDIRECT
      ? '/auth/saml/login'
      : `/auth/saml/login?next=${encodeURIComponent(safeNext)}`;
  const devLoginHref = (role: string, email: string) => {
    const params = new URLSearchParams({ role, email });
    if (safeNext !== DEFAULT_REDIRECT) params.set('redirect', safeNext);
    return `/auth/dev-login?${params.toString()}`;
  };

  return (
    <main id="main-content" className="flex min-h-svh">
      {/* Left panel — Demo brand */}
      <div className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden p-16 text-white lg:flex"
        style={{
          background: 'linear-gradient(135deg, #1E3932 0%, #006241 40%, #00754A 70%, #2d8f6f 100%)',
        }}
      >
        {/* SVG pattern overlay */}
        <div className="absolute inset-0 opacity-100"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        {/* Abstract shapes */}
        <div className="absolute -right-20 -top-24 h-[400px] w-[400px] rounded-full opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)' }}
        />
        <div className="absolute -bottom-16 -left-10 h-[300px] w-[300px] rounded-full opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, rgba(203,162,88,0.2), transparent 70%)' }}
        />
        <div className="absolute left-[10%] top-[20%] h-[200px] w-[200px] opacity-[0.08]"
          style={{ border: '3px solid rgba(255,255,255,0.1)', borderRadius: '40% 60% 50% 50%' }}
        />
        <div className="absolute bottom-[30%] right-[10%] h-20 w-40 -rotate-[15deg] opacity-[0.08]"
          style={{ border: '2px solid rgba(203,162,88,0.15)', borderRadius: '50%' }}
        />

        {/* Brand content */}
        <div className="relative z-10 max-w-[400px] text-center">
          <div className="font-[family-name:var(--font-sans)] text-[56px] font-extrabold leading-none tracking-[0.08em]"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.15)' }}
          >
            Demo
          </div>
          <div className="mb-8 mt-3 text-sm font-normal uppercase tracking-[0.16em] text-white/70">
            Example Software Department
          </div>
          <div className="mx-auto mb-8 h-0.5 w-16 rounded-full bg-[var(--color-starbucks-gold)]" />
          <p className="mx-auto max-w-xs text-lg leading-relaxed text-white/60">
            Unified weekly status reporting system for department leads and management
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="relative flex w-full flex-col items-center justify-center bg-white px-16 lg:w-[480px] lg:flex-none">
        {/* Left border accent */}
        <div className="absolute bottom-[10%] left-0 top-[10%] hidden w-px lg:block"
          style={{ background: 'linear-gradient(to bottom, transparent, #ece8e2, transparent)' }}
        />

        <div className="w-full max-w-[320px] text-center">
          <h1 className="font-[family-name:var(--font-sans)] text-[32px] font-bold tracking-[-0.02em] text-[var(--color-primary)]">
            CustomReport
          </h1>
          <p className="mb-12 mt-2 text-[15px] text-[var(--color-muted-foreground)]">
            Weekly Status Reporting System
          </p>

          {/* SSO button — or direct entry when stub / dev-role-switcher */}
          {DEV_ROLE_SWITCHER ? (
            <div className="space-y-4">
              {/* Primary CTA — default identity (admin) */}
              {(() => {
                const def = devLoginIdentities.find((i) => i.role === 'admin') ?? devLoginIdentities[0];
                return (
                  <a
                    href={devLoginHref(def.role, def.email)}
                    className="flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-4 font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-white transition-all hover:bg-[var(--color-primary)] hover:-translate-y-px"
                    style={{ minHeight: '52px', boxShadow: '0 2px 12px rgba(0,98,65,0.2)' }}
                    data-testid={`dev-login-default-${def.role}-${def.email}`}
                  >
                    <span aria-hidden>{def.icon}</span>
                    Sign in as {def.label}
                  </a>
                );
              })()}

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-[#ece8e2]" />
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
                  or sign in as
                </span>
                <div className="h-px flex-1 bg-[#ece8e2]" />
              </div>

              {/* Fineprint — non-default identities as small inline links */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12px] leading-relaxed">
                {devLoginIdentities
                  .filter((i) => i.role !== 'admin')
                  .map(({ label, role, email }, idx, arr) => (
                    <span key={email} className="inline-flex items-center">
                      <a
                        href={devLoginHref(role, email)}
                        className="text-[var(--color-muted-foreground)] underline-offset-4 transition-colors hover:text-[var(--color-foreground)] hover:underline"
                        data-testid={`dev-login-${role}-${email}`}
                      >
                        {label}
                      </a>
                      {idx < arr.length - 1 && (
                        <span aria-hidden className="ml-3 text-[var(--color-muted-foreground)]/40">·</span>
                      )}
                    </span>
                  ))}
              </div>

              <p className="text-center text-[11px] tracking-[0.04em] text-[var(--color-muted-foreground)]/70">
                DEV mode · seeded identities · no Keycloak required
              </p>
            </div>
          ) : AUTH_STUB ? (
            <div className="space-y-3">
              <a
                href={safeNext}
                className="flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-4 font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-white transition-all hover:bg-[var(--color-primary)] hover:-translate-y-px"
                style={{
                  minHeight: '52px',
                  boxShadow: '0 2px 12px rgba(0,98,65,0.2)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Enter Application
              </a>

              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-[#ece8e2]" />
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
                  or select role
                </span>
                <div className="h-px flex-1 bg-[#ece8e2]" />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {stubRoles.map(({ label, redirect, icon }) => {
                  // When ?next= is explicitly provided, all role buttons honor it.
                  // Otherwise each button uses its role's natural landing page.
                  const href = safeNext === DEFAULT_REDIRECT ? redirect : safeNext;
                  return (
                    <a
                      key={label}
                      href={href}
                      className="flex items-center justify-center gap-2 rounded-[var(--radius)] border border-[rgba(0,0,0,0.12)] bg-white px-3 py-2.5 text-[13px] font-medium text-[var(--color-foreground)] transition-all hover:border-[rgba(0,0,0,0.24)] hover:bg-[#f8f6f2]"
                      style={{ minHeight: '44px' }}
                    >
                      <span>{icon}</span>
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          ) : (
            <a
              href={ssoHref}
              className="flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-4 font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-white transition-all hover:bg-[var(--color-primary)] hover:-translate-y-px active:translate-y-0 active:opacity-90"
              style={{
                minHeight: '52px',
                boxShadow: '0 2px 12px rgba(0,98,65,0.2)',
              }}
              aria-label="Sign in with corporate SSO"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Sign in with SSO
            </a>
          )}

          <p className="mt-6 text-xs tracking-[0.02em] text-[var(--color-muted-foreground)]">
            Keycloak · SAML 2.0 · Corporate SSO
          </p>

          <div className="mx-auto my-10 h-px w-full max-w-[320px] bg-[#ece8e2]" />

          <p className="text-xs tracking-[0.02em] text-[var(--color-muted-foreground)]">
            Development Department · v4.0
          </p>
        </div>
      </div>
    </main>
  );
}
