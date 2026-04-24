const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';
const AUTH_STUB = process.env.NEXT_PUBLIC_AUTH_STUB === 'true';

const stubRoles = [
  { role: 'lead', label: 'Enter as Lead', redirect: '/lead/report', icon: '📝' },
  { role: 'head', label: 'Enter as Head', redirect: '/head/dashboard', icon: '👔' },
  { role: 'head', label: 'Enter as Admin', redirect: '/admin', icon: '⚙️' },
  { role: 'viewer', label: 'Enter as Viewer', redirect: '/reports/history', icon: '👁' },
] as const;

export default function LoginPage() {
  return (
    <div className="flex min-h-svh">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-[var(--color-starbucks-green)] to-[var(--color-starbucks-house)] p-12 text-white">
        <div>
          <div className="text-2xl font-semibold tracking-tight">CustomReport</div>
          <div className="mt-1 text-sm font-light opacity-80">Software Development</div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Weekly Status
            <br />
            Reporting
          </h1>
          <p className="max-w-sm text-base font-light leading-relaxed opacity-80">
            Structured reports from team leads, auto-compiled into a single
            department overview. No conflicts, full history, instant PDF.
          </p>
        </div>

        {/* Decorative shapes */}
        <div className="flex gap-4 opacity-20">
          <div className="h-16 w-16 rounded-full border-2 border-white" />
          <div className="h-16 w-16 rotate-45 border-2 border-white" />
          <div className="h-16 w-16 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Right panel — auth */}
      <div className="flex w-full flex-col items-center justify-center px-8 lg:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="space-y-2 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-starbucks-green)]">
              <span className="text-2xl font-bold text-white">C</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
              CustomReport
            </h2>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Sign in to your account
            </p>
          </div>

          {/* SSO button */}
          <a
            href={`${API_BASE_URL}/auth/saml/login`}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-3 text-base font-medium text-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-3 focus:ring-[var(--color-ring)]"
            style={{ minHeight: '44px' }}
          >
            Sign in with SSO
          </a>

          {/* Dev stub buttons */}
          {AUTH_STUB && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-muted-foreground)]">
                  Development Mode
                </span>
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {stubRoles.map(({ role, label, redirect, icon }) => (
                  <a
                    key={label}
                    href={`${API_BASE_URL}/auth/dev-login?role=${role}&redirect=${redirect}`}
                    className="btn-press flex items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-medium text-[var(--color-foreground)] shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-3 focus:ring-[var(--color-ring)]"
                    style={{ minHeight: '44px' }}
                  >
                    <span>{icon}</span>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
