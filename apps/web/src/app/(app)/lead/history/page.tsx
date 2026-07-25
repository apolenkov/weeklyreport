import { redirect } from "next/navigation";

// Legacy route → /reports (307, no query).
export default function LeadHistoryRedirect() {
  redirect("/reports");
}
