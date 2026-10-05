"use client";

import Image from "next/image";

export interface FeedbackCaptureItem {
  readonly viewport: string;
  readonly screenshotUrl?: string | null | undefined;
  readonly screenshotRegion?:
    | {
        readonly xPct: number;
        readonly yPct: number;
        readonly wPct: number;
        readonly hPct: number;
      }
    | null
    | undefined;
  readonly diagnostics?:
    | {
        readonly console: readonly {
          readonly level: string;
          readonly message: string;
          readonly timestamp: string;
        }[];
        readonly network: readonly {
          readonly method: string;
          readonly status: number;
          readonly url: string;
          readonly timestamp: string;
        }[];
      }
    | null
    | undefined;
}

const PERCENT = 100;
const FALLBACK_VIEWPORT_WIDTH = 1280;
const FALLBACK_VIEWPORT_HEIGHT = 720;

function captureDimensions(viewport: string): {
  readonly width: number;
  readonly height: number;
} {
  const match = /^(\d+)x(\d+)$/.exec(viewport);
  if (!match) {
    return {
      width: FALLBACK_VIEWPORT_WIDTH,
      height: FALLBACK_VIEWPORT_HEIGHT,
    };
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

function CaptureScreenshot({ item }: { readonly item: FeedbackCaptureItem }) {
  const region = item.screenshotRegion;
  const dimensions = captureDimensions(item.viewport);
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <Image
        alt="Page screenshot captured with this annotation"
        className="block h-auto w-full"
        height={dimensions.height}
        src={item.screenshotUrl ?? ""}
        unoptimized
        width={dimensions.width}
      />
      {region ? (
        <span
          aria-label="Annotated region"
          className="pointer-events-none absolute border-2 border-amber-400 bg-amber-300/15 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
          role="img"
          style={{
            height: `${region.hPct * PERCENT}%`,
            left: `${region.xPct * PERCENT}%`,
            top: `${region.yPct * PERCENT}%`,
            width: `${region.wPct * PERCENT}%`,
          }}
        />
      ) : null}
    </div>
  );
}

function CaptureDiagnostics({ item }: { readonly item: FeedbackCaptureItem }) {
  const consoleEntries = item.diagnostics?.console ?? [];
  const networkEntries = item.diagnostics?.network ?? [];
  return (
    <div className="space-y-3 text-xs text-[var(--color-ink-muted)]">
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Viewport", item.viewport],
          ["Console", consoleEntries.length],
          ["Network", networkEntries.length],
        ].map(([label, value]) => (
          <span
            className="rounded-lg border border-[var(--color-border)] px-2 py-2"
            key={label}
          >
            {label}
            <br />
            <strong className="text-[var(--color-ink)]">{value}</strong>
          </span>
        ))}
      </div>
      {consoleEntries.length > 0 ? (
        <details className="rounded-lg border border-[var(--color-border)] p-3">
          <summary className="font-medium text-[var(--color-ink)]">
            Console diagnostics
          </summary>
          <ul className="mt-2 space-y-2">
            {consoleEntries.map((entry) => (
              <li
                className="break-words font-mono"
                key={`${entry.timestamp}-${entry.level}-${entry.message}`}
              >
                [{entry.level}] {entry.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {networkEntries.length > 0 ? (
        <details className="rounded-lg border border-[var(--color-border)] p-3">
          <summary className="font-medium text-[var(--color-ink)]">
            Failed network requests
          </summary>
          <ul className="mt-2 space-y-2">
            {networkEntries.map((entry) => (
              <li
                className="break-all font-mono"
                key={`${entry.timestamp}-${entry.method}-${entry.status}-${entry.url}`}
              >
                {entry.method} {entry.status} {entry.url}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function FeedbackCaptureEvidence({
  item,
}: {
  readonly item: FeedbackCaptureItem;
}) {
  return (
    <section
      aria-label="Captured annotation evidence"
      className="mt-4 grid gap-4 border-t border-[var(--color-border)] pt-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]"
    >
      <CaptureScreenshot item={item} />
      <CaptureDiagnostics item={item} />
    </section>
  );
}
