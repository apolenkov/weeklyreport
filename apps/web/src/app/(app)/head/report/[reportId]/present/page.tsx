import { permanentRedirect } from "next/navigation";

interface Props {
  params: Promise<{ reportId: string }>;
}

// Keep legacy `/present` deep links resolving while presentation lives inline;
// permanentRedirect is required because redirect() emits 307, not the contract's 308.
export default async function HeadReportPresentPage({ params }: Props) {
  const { reportId } = await params;
  permanentRedirect(`/head/report/${reportId}?mode=slides`);
}
