"use client";

export interface ProductChipEntry {
  productId: string;
  productName: string;
  worstStatus: "blocked" | "at-risk" | "on-track" | "empty";
}

interface Props {
  readonly products: readonly ProductChipEntry[];
  readonly activeProductId?: string;
  readonly onSelect?: (productId: string) => void;
}

function statusDot(status: ProductChipEntry["worstStatus"]) {
  const colorClass = {
    blocked: "bg-[var(--color-destructive)]",
    "at-risk": "bg-[#d4a017]",
    "on-track": "bg-[var(--color-primary)]",
    empty: "bg-[var(--color-muted-foreground)] opacity-50",
  }[status];

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
      role="tablist"
      aria-label="Products"
      className="grid grid-flow-col auto-cols-fr gap-2"
    >
      {products.map((product) => {
        const isActive = product.productId === activeProductId;
        return (
          <button
            key={product.productId}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`product-card-${product.productId}`}
            title={product.productName}
            onClick={() => onSelect?.(product.productId)}
            className={[
              "inline-flex min-w-0 items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "border-[var(--color-primary)] bg-white font-semibold text-[var(--color-primary)] underline underline-offset-2 decoration-[var(--color-primary)]"
                : "border-[rgba(0,0,0,0.10)] bg-white/70 font-normal text-[var(--color-foreground)] hover:border-[var(--color-border)] hover:bg-white",
            ].join(" ")}
          >
            {statusDot(product.worstStatus)}
            <span className="line-clamp-2 break-words">
              {product.productName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
