"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import type { MockProduct } from "../model/admin-types";
import { invalidateGroupProductOwnership } from "../model/group-products-invalidation";

// A product has exactly one owning group — other-group products show locked.
/**
 * Group Products Editor.
 * @param options - The options argument.
 */
export function GroupProductsEditor({
  groupId,
  products,
}: {
  readonly groupId: string;
  readonly products: readonly MockProduct[];
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const attachedQuery = useQuery(
    trpc.admin.listGroupProducts.queryOptions({ groupId }),
  );

  const attachedIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of attachedQuery.data ?? []) set.add(row.id);
    return set;
  }, [attachedQuery.data]);

  const attachMut = useMutation(
    trpc.admin.attachProductToGroup.mutationOptions({
      onSuccess: async () => {
        // Reassign invalidates every listGroupProducts query (old group too).
        await Promise.all([
          qc.invalidateQueries(trpc.admin.listGroupProducts.pathFilter()),
          invalidateGroupProductOwnership(qc, trpc),
        ]);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const detachMut = useMutation(
    trpc.admin.detachProductFromGroup.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          qc.invalidateQueries({
            queryKey: trpc.admin.listGroupProducts.queryKey({ groupId }),
          }),
          invalidateGroupProductOwnership(qc, trpc),
        ]);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.status !== "archived"),
    [products],
  );

  const activeProductIds = useMemo(
    () => activeProducts.map((product) => product.id),
    [activeProducts],
  );

  // Single batched ownership read for every active product, replacing the
  // per-product listProductGroups fan-out. Skipped when there are no active
  // products (the empty-list branch renders instead).
  const ownershipQuery = useQuery({
    ...trpc.admin.listProductGroupOwnership.queryOptions({
      productIds: activeProductIds,
    }),
    enabled: activeProductIds.length > 0,
  });

  const owningGroupByProductId = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const entry of ownershipQuery.data ?? []) {
      if (entry.group) map.set(entry.productId, entry.group);
    }
    return map;
  }, [ownershipQuery.data]);

  const ownershipLoading = ownershipQuery.isLoading;

  const isPending = attachMut.isPending || detachMut.isPending;

  function toggle(productId: string, nextChecked: boolean): void {
    const owner = owningGroupByProductId.get(productId);
    if (nextChecked && owner && owner.id !== groupId) {
      toast.error(`Already attached to ${owner.name}`);
      return;
    }

    if (nextChecked) {
      attachMut.mutate({ groupId, productId });
    } else {
      detachMut.mutate({ groupId, productId });
    }
  }

  return (
    <fieldset
      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3"
      data-testid="group-products-editor"
    >
      <legend className="px-1 text-sm font-medium text-[var(--color-foreground)]">
        Products attached
      </legend>
      <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
        Explicit Group ↔ Product mapping. Toggle to attach or detach free
        products. Products already attached to another group are locked here.
      </p>
      {attachedQuery.isLoading ? (
        <div
          className="py-1 text-xs text-[var(--color-muted-foreground)]"
          data-testid="group-products-loading"
        >
          Loading…
        </div>
      ) : activeProducts.length === 0 ? (
        <div className="py-1 text-xs text-[var(--color-muted-foreground)]">
          No active products yet. Create one in the Products tab first.
        </div>
      ) : (
        <ul
          className="max-h-40 space-y-1 overflow-y-auto pr-1"
          data-testid="group-products-list"
        >
          {activeProducts.map((product) => {
            const checked = attachedIds.has(product.id);
            const owner = owningGroupByProductId.get(product.id);
            const lockedByOtherGroup = Boolean(
              owner && owner.id !== groupId && !checked,
            );
            const hintId = `group-product-hint-${product.id}`;
            const disabled =
              isPending || lockedByOtherGroup || ownershipLoading;

            return (
              <li key={product.id}>
                <label
                  className={[
                    "flex items-start gap-2 rounded-sm px-1 py-0.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
                    disabled
                      ? "cursor-not-allowed opacity-70"
                      : "cursor-pointer",
                  ].join(" ")}
                  title={
                    lockedByOtherGroup && owner
                      ? `Already attached to ${owner.name}`
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => toggle(product.id, e.target.checked)}
                    aria-label={`Toggle ${product.name}`}
                    aria-describedby={
                      lockedByOtherGroup || ownershipLoading
                        ? hintId
                        : undefined
                    }
                    className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                  />
                  <span className="min-w-0">
                    <span>{product.name}</span>
                    {lockedByOtherGroup && owner && (
                      <span
                        id={hintId}
                        className="block text-xs text-[var(--color-muted-foreground)]"
                      >
                        Already attached to {owner.name}
                      </span>
                    )}
                    {ownershipLoading && (
                      <span
                        id={hintId}
                        className="block text-xs text-[var(--color-muted-foreground)]"
                      >
                        Checking group assignment…
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
