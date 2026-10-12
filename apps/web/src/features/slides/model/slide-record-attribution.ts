import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { buildContributorRoster } from "./slide-grid-authors";
import type { GridAuthor } from "./slide-grid-rows";

export type SlideSourceRecord =
  | ReportSectionReadModel["items"][number]
  | ReportSectionReadModel["risks"][number]
  | ReportSectionReadModel["decisions"][number];

export interface SlideRecordAttribution {
  readonly authors: readonly GridAuthor[];
  readonly owners: ReadonlyMap<SlideSourceRecord, GridAuthor>;
}

// Product aggregation retains the original row objects, including rows without IDs.
export function buildSlideRecordAttribution(
  sections: readonly ReportSectionReadModel[],
): SlideRecordAttribution {
  const authors = buildContributorRoster(sections);
  const byId = new Map(authors.map((author) => [author.id, author]));
  const owners = new Map(
    sections.flatMap((section) => {
      const author = byId.get(section.authorId);
      if (!author) throw new Error("Missing slide contributor");
      return [...section.items, ...section.risks, ...section.decisions].map(
        (record) => [record, author] as const,
      );
    }),
  );
  return { authors, owners };
}

export function attributedRecordAuthor(
  record: SlideSourceRecord,
  attribution: SlideRecordAttribution,
): GridAuthor {
  const author = attribution.owners.get(record);
  if (!author) throw new Error("Missing slide record author");
  return author;
}
