import type { AdminProductView } from "./admin-types";

export interface ProductFormData {
  name: string;
  leadId: string;
}

export const EMPTY_PRODUCT_FORM: ProductFormData = {
  name: "",
  leadId: "",
};

export function formFromProduct(product: AdminProductView): ProductFormData {
  return {
    name: product.name,
    leadId: product.leadOwnerId,
  };
}
