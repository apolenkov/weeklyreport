import { permanentRedirect } from "next/navigation";

interface Props {
  params: Promise<{ reportId: string }>;
}

/**
 * The standalone head slide-deck surface is gone. Presentation now lives
 * inline on the report page via `?mode=slides` (HeadReportShell). This route
 * is KEPT (not deleted) so existing `/present` deep links keep resolving —
 * it 308-redirects to slides mode. Next.js 16's `redirect()` is a 307;
 * `permanentRedirect()` is the 308 this contract requires.
 */
export default async function HeadReportPresentPage({ params }: Props) {
  const { reportId } = await params;
  permanentRedirect(`/head/report/${reportId}?mode=slides`);
}
