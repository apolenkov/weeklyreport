import { redirect } from "next/navigation";

// HEAD-CONSOLIDATE-01: /head/slides is an alias; canonical route is /head/history?mode=slides.
// Redirect preserves any existing bookmarks.
export default function HeadSlidesPage() {
  redirect("/head/history?mode=slides");
}
