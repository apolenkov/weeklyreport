import type { ReportSectionsRepository } from "../report-sections.service";

type ReportMeta = Awaited<
  ReturnType<ReportSectionsRepository["getReportMeta"]>
>;

export const OPEN_REPORT_META: NonNullable<ReportMeta> = {
  status: "draft",
  deadline: new Date("2100-01-01T00:00:00.000Z"),
};

// Every repository fake must state whether the report exists and which
// deadline it carries; returning null accidentally disables the submit gate.
export function reportMetaReader(meta: ReportMeta) {
  return (): Promise<ReportMeta> =>
    Promise.resolve(meta ? structuredClone(meta) : null);
}
