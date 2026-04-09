'use client';

import { useMemo, useState } from 'react';

import { AppShell } from '../../../../components/navigation/app-shell';
import { AssembledReportReview } from '../../../../components/head/assembled-report-review';
import {
  applyReviewSectionUpdate,
  buildDraftAssembledReport,
  persistPublishedReport,
  publishReportSnapshot,
  readPublishedReport,
} from '../../../../components/report/report-runtime';
import { defaultHeadSession, readBrowserSession } from '../../../../lib/dev-session';
import type { DraftSavePayload } from '@customreport/shared';

export default function HeadReportPage() {
  const session = useMemo(() => readBrowserSession(defaultHeadSession), []);
  const [report, setReport] = useState(() => readPublishedReport() ?? buildDraftAssembledReport());

  async function handleUpdateSection(input: DraftSavePayload) {
    const nextReport = applyReviewSectionUpdate(report, input);
    setReport(nextReport);

    return nextReport;
  }

  async function handlePublish() {
    const publishedReport = persistPublishedReport(publishReportSnapshot(report, session));
    setReport(publishedReport);

    return publishedReport;
  }

  return (
    <AppShell activeReportId={session.activeReportId} currentPath="/head/report" role={session.role}>
      {session.role !== 'head' ? (
        <p>Access denied. This review screen is available only to head users.</p>
      ) : (
        <AssembledReportReview
          initialReport={report}
          onPublish={handlePublish}
          onUpdateSection={handleUpdateSection}
        />
      )}
    </AppShell>
  );
}
