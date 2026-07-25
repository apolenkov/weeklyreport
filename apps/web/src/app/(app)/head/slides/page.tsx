import { redirect } from "next/navigation";

// Legacy alias → /reports (no query).
export default function HeadSlidesPage() {
  redirect("/reports");
}
