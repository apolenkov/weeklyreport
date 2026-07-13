import type { MockProduct } from "../../../shared/lib/admin-mock-data";

export interface ProductFormData {
  name: string;
  leadId: string;
}

export const EMPTY_PRODUCT_FORM: ProductFormData = {
  name: "",
  leadId: "",
};

export function formFromProduct(product: MockProduct): ProductFormData {
  return {
    name: product.name,
    leadId: product.leadOwnerId,
  };
}
