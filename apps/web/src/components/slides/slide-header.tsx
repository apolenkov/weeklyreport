import Link from "next/link";

import type { SlideTone } from "./section-slide-utils";

const toneClass: Record<SlideTone, string> = {
  ready:
    "border-[rgba(0,117,74,0.28)] bg-[rgba(229,245,237,0.74)] text-[var(--color-primary)]",
  warning: "border-[rgba(212,160,23,0.38)] bg-[#fff7df] text-[#725313]",
  blocked:
    "border-[rgba(200,32,20,0.24)] bg-[#fff1f0] text-[var(--color-destructive)]",
  empty:
    "border-[rgba(0,0,0,0.14)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

type SlideStatusBadge = {
  readonly label: string;
  readonly tone: SlideTone;
};

type SlideHeaderProps = {
  readonly title: string;
  readonly subtitle?: string | null;
  readonly statusBadge?: SlideStatusBadge | null;
  readonly exitHref?: string;
  readonly exitLabel?: string;
};

export function SlideHeader({
  title,
  subtitle,
  statusBadge,
  exitHref,
  exitLabel = "Edit",
}: SlideHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(0,0,0,0.08)] pb-4">
      <div className="min-w-0">
        <h2 className="font-[family-name:var(--font-sans)] text-xl font-semibold text-[var(--color-primary)]">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {statusBadge ? (
          <span
            className={[
              "inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-semibold",
              toneClass[statusBadge.tone],
            ].join(" ")}
          >
            {statusBadge.label}
          </span>
        ) : null}
        {exitHref ? (
          <Link
            href={exitHref}
            scroll={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)]"
          >
            ↩ {exitLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
