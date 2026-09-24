import { useEffect, useRef } from "react";

interface UseProductDeepLinkExpandArgs {
  readonly productFilter: string | null | undefined;
  readonly products: readonly { readonly id: string }[];
  readonly setExpandedId: (id: string) => void;
}

// Auto-expand `?product` once per filter; first manual toggle on any row
// wins until the deep link changes so a refetch does not re-collapse the
// row the user opened.
export function useProductDeepLinkExpand({
  productFilter,
  products,
  setExpandedId,
}: UseProductDeepLinkExpandArgs): Readonly<{
  markUserToggle: (id: string) => void;
}> {
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
    markUserToggle: () => {
      hasUserToggledRef.current = true;
    },
  };
}
