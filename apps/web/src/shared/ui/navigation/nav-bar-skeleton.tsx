/**
 * Static skeleton placeholder for the top nav-bar.
 *
 * Renders at the exact same height + horizontal layout as <NavBar> so
 * the swap from skeleton → real nav is a pure opacity/content swap
 * with zero layout shift (CLS budget = 0).
 *
 * Mounted as the Suspense fallback in `app/(app)/layout.tsx` while
 * the session query resolves. A `null` fallback flashes on cold reload —
 * the nav-bar height pops in after auth.me resolves; this skeleton
 * reserves that height.
 *
 * The grey segments match the proportions of:
 *  - logo + brand (left)
 *  - 3-4 nav pill links (center)
 *  - role pill + logout (right)
 *
 * No animation: pulse/shimmer would itself become noise; a static
 * skeleton at the correct height is the cleanest fix for FOUC.
 * Respects prefers-reduced-motion implicitly because there's no motion.
 */
export function NavBarSkeleton() {
  return (
    <header
      className="w-full bg-[var(--color-card)]"
      data-testid="nav-bar-skeleton"
      aria-hidden="true"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand: monogram pill + 2-line text stack */}
        <div className="flex items-center gap-2.5 py-4">
          <div className="h-9 w-9 rounded-full bg-[var(--color-muted)]/40" />
          <div className="hidden flex-col gap-1 sm:flex">
            <div className="h-3 w-16 rounded bg-[var(--color-muted)]/40" />
            <div className="h-2.5 w-24 rounded bg-[var(--color-muted)]/30" />
          </div>
        </div>

        {/* Nav links — 4 placeholder pills, hidden on small viewports */}
        <nav className="hidden gap-1 sm:flex" aria-label="Loading navigation">
          <div className="h-9 w-20 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/30" />
          <div className="h-9 w-24 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/30" />
          <div className="h-9 w-20 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/30" />
          <div className="h-9 w-16 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/30" />
        </nav>

        {/* Role pill + logout */}
        <div className="flex items-center gap-2.5 py-4">
          <div className="h-8 w-20 rounded-[var(--radius-pill)] bg-[var(--color-muted)]/40" />
          <div className="h-8 w-8 rounded-full bg-[var(--color-muted)]/40" />
        </div>
      </div>
    </header>
  );
}
