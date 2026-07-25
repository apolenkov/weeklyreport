import { redirect } from "next/navigation";

// Alias so direct URLs and integration-test navigations stay readable.
export default function AdminProductsPage(): never {
  redirect("/admin?tab=products");
}
