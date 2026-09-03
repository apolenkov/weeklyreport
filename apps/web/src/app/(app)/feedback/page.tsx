import { notFound } from "next/navigation";

import { ProductFeedbackPage } from "../../../features/product-feedback";
import { webEnv } from "../../../shared/lib/runtime/web-env";

export default function FeedbackPage() {
  if (!webEnv.productFeedback()) notFound();
  return <ProductFeedbackPage />;
}
