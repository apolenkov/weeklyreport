'use client';

import { useState } from 'react';

import { StageChip } from './stage-chip';
import type { Product, StageStatus } from './mock-data';

type SdlcPipelineProps = {
  readonly products: Product[];
  readonly readOnly?: boolean;
};

function ProductStatusBadge({ status }: { readonly status: StageStatus }) {
  if (status === 'on-track') {
    return <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[11px] font-semibold text-[var(--color-primary)]">On Track</span>;
  }
  if (status === 'at-risk') {
    return <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[#fef3c7] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[11px] font-semibold text-[#8a6d1b]">! At Risk</span>;
  }
  if (status === 'blocked') {
    return <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[#fee2e2] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[11px] font-semibold text-[var(--color-destructive)]">&times; Blocked</span>;
  }
  return null;
}

function getProductBackground(status: StageStatus): string {
  if (status === 'blocked') return '#fdf8f8';
  if (status === 'at-risk') return '#fffcf5';
  return 'var(--color-background)';
}

function getProductBorderColor(status: StageStatus): string {
  if (status === 'blocked') return 'rgba(200,32,20,0.15)';
  if (status === 'at-risk') return 'rgba(212,160,23,0.15)';
  return 'var(--color-muted)';
}

export function SdlcPipeline({ products, readOnly = false }: SdlcPipelineProps) {
  const [localProducts, setLocalProducts] = useState(products);

  function handleStatusChange(productId: string, stageName: string, newStatus: StageStatus) {
    setLocalProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          stages: p.stages.map((s) =>
            s.stageName === stageName ? { ...s, status: newStatus } : s,
          ),
        };
      }),
    );
  }

  return (
    <div className="space-y-4">
      {localProducts.map((product) => (
        <div
          key={product.id}
          className="rounded-xl p-4"
          style={{
            background: getProductBackground(product.overallStatus),
            border: `1px solid ${getProductBorderColor(product.overallStatus)}`,
          }}
        >
          {/* Product header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
                {product.name}
              </span>
              {product.riskSummary && (
                <span className="text-[11px] font-semibold text-[var(--color-destructive)]">
                  {product.riskSummary}
                </span>
              )}
            </div>
            <ProductStatusBadge status={product.overallStatus} />
          </div>

          {/* Stages row */}
          <div className="flex flex-wrap gap-2 pb-1">
            {product.stages.map((stage, idx) => (
              <div key={stage.stageName} className="flex items-start gap-2">
                {idx > 0 && (
                  <div
                    className="flex items-center text-lg font-bold"
                    style={{
                      color:
                        stage.ownership === 'mine' || product.stages[idx - 1]?.ownership === 'mine'
                          ? 'var(--color-starbucks-accent)'
                          : 'var(--color-muted-foreground)',
                      marginTop: '-14px',
                      alignSelf: 'center',
                    }}
                  >
                    &rarr;
                  </div>
                )}
                <div className="relative">
                  <StageChip
                    stage={stage}
                    readOnly={readOnly}
                    onStatusChange={(name, status) =>
                      handleStatusChange(product.id, name, status)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
