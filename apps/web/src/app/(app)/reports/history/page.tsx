import { redirect } from "next/navigation";

// Legacy archive → /reports (no query).
export default function ReportsHistoryRedirect() {
  redirect("/reports");
}
