import { redirect } from "next/navigation";

// Collapses into /reports (no query) — shared history surface.
export default function HeadHistoryRedirect() {
  redirect("/reports");
}
