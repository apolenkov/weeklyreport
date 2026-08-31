import { z } from "zod";

/** Explicit development database reset profiles accepted by the dev router. */
export const reseedVariantSchema = z.enum([
  "minimal",
  "demo",
  "full",
  "stress",
]);

/** Development database reset profile selected by the dev router. */
export type ReseedVariant = z.infer<typeof reseedVariantSchema>;
