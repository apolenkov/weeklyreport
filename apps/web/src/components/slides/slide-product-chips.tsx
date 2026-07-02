"use client";

export type ProductStatus = "blocked" | "at-risk" | "on-track" | "empty";

export interface ProductChipEntry {
  productId: string;
  productName: string;
  worstStatus: ProductStatus;
}

interface Props {
  readonly products: readonly ProductChipEntry[];
  readonly activeProductId?: string;
  readonly onSelect?: (productId: string) => void;
}

/** Maps a raw traffic-light color to a semantic ProductStatus. D3: single source. */
export function mapTrafficLightToStatus(
  color: "red" | "yellow" | "green" | null | undefined,
): ProductStatus {
  if (color === "red") return "blocked";
  if (color === "yellow") return "at-risk";
  if (color === "green") return "on-track";
  return "empty";
}

/**
 * Tailwind class for a status dot of the given status.
 * at-risk references the named token (D6) instead of a hardcoded hex.
 * Module-private: rows use neutral product badges (feedback round 3), so
 * the chip strip is the only status-dot surface.
 */
const STATUS_DOT_CLASS: Record<ProductStatus, string> = {
  blocked: "bg-[var(--color-destructive)]",
  "at-risk": "bg-[var(--color-status-dot-at-risk)]",
  "on-track": "bg-[var(--color-primary)]",
  empty: "bg-[var(--color-muted-foreground)] opacity-50",
};

/** Human-readable status label, exposed to assistive tech via an sr-only span. */
const STATUS_LABEL: Record<ProductStatus, string> = {
  blocked: "Blocked",
  "at-risk": "At risk",
  "on-track": "On track",
  empty: "No status",
};

function statusDot(status: ProductStatus) {
  const colorClass = STATUS_DOT_CLASS[status];

  return (
    <span
      aria-hidden="true"
      className={[
        "inline-block h-2 w-2 shrink-0 rounded-full",
        colorClass,
      ].join(" ")}
    />
  );
}

export function SlideProductChips({
  products,
  activeProductId,
  onSelect,
}: Props) {
  if (products.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Products"
      className="grid grid-flow-col auto-cols-fr gap-2"
    >
      {products.map((product) => {
        const isActive = product.productId === activeProductId;
        return (
          <button
            key={product.productId}
            type="button"
            aria-pressed={isActive}
            title={product.productName}
            onClick={(event) => {
              // The lead slide article exits fullscreen on any click; picking
              // a product must scope the slide without ending presentation.
              event.stopPropagation();
              onSelect?.(product.productId);
            }}
            className={[
              "inline-flex min-w-0 items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "border-[var(--color-primary)] bg-white font-semibold text-[var(--color-primary)] underline underline-offset-2 decoration-[var(--color-primary)]"
                : "border-[rgba(0,0,0,0.10)] bg-white/70 font-normal text-[var(--color-foreground)] hover:border-[var(--color-border)] hover:bg-white",
            ].join(" ")}
          >
            {statusDot(product.worstStatus)}
            <span className="sr-only">{STATUS_LABEL[product.worstStatus]}</span>
            <span className="line-clamp-2 break-words">
              {product.productName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
