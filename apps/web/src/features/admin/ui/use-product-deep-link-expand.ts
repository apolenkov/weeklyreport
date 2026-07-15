import { useEffect, useRef } from "react";

interface UseProductDeepLinkExpandArgs {
  readonly productFilter: string | null | undefined;
  readonly products: readonly { readonly id: string }[];
  readonly setExpandedId: (id: string) => void;
}

/**
 * Auto-expands the product row named by the `?product` deep link — once per
 * filter value. The admin's first manual toggle of that row wins until the
 * deep link changes, so the effect never re-expands a row the admin just
 * collapsed. Call `markUserToggle` from the row's toggle handler.
 */
export function useProductDeepLinkExpand({
  productFilter,
  products,
  setExpandedId,
}: UseProductDeepLinkExpandArgs): { markUserToggle: (id: string) => void } {
  const hasUserToggledRef = useRef(false);
  const previousProductFilterRef = useRef(productFilter);

  useEffect(() => {
    const productFilterChanged =
      previousProductFilterRef.current !== productFilter;
    previousProductFilterRef.current = productFilter;
    if (productFilterChanged) hasUserToggledRef.current = false;
    if (!productFilter) return;
    if (hasUserToggledRef.current) return;
    if (products.some((product) => product.id === productFilter)) {
      setExpandedId(productFilter);
    }
  }, [productFilter, products, setExpandedId]);

  return {
    markUserToggle: (id: string) => {
      if (id === productFilter) hasUserToggledRef.current = true;
    },
  };
}
