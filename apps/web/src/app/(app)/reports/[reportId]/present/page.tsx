import { permanentRedirect } from "next/navigation";

interface Props {
  params: Promise<{ reportId: string }>;
}

/**
 * fix-report-surface-integrity W2 (task 3.3): the standalone published
 * slide-deck surface is gone. Presentation now lives inline on the report
 * page via `?mode=slides`. This route is KEPT (not deleted) so existing
 * `/present` deep links keep resolving — it 308-redirects to slides mode.
 * Next.js 16's `redirect()` is a 307; `permanentRedirect()` is the 308 this
 * contract requires.
 */
export default async function PublishedReportPresentPage({ params }: Props) {
  const { reportId } = await params;
  permanentRedirect(`/reports/${reportId}?mode=slides`);
}
