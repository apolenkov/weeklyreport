import type { MockProduct } from "./admin-types";

export interface ProductFormData {
  name: string;
  leadId: string;
}

export const EMPTY_PRODUCT_FORM: ProductFormData = {
  name: "",
  leadId: "",
};

/**
 * Form From Product.
 * @param product - The product argument.
 */
export function formFromProduct(product: MockProduct): ProductFormData {
  return {
    name: product.name,
    leadId: product.leadOwnerId,
  };
}
