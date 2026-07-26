import { redirect } from "next/navigation";

// Alias so direct URLs and integration-test navigations stay readable.
export default function AdminActivitiesPage(): never {
  redirect("/admin?tab=activities");
}
