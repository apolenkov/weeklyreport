import type { ReportSectionReadModel } from "@customreport/shared";

import { initialsFromName } from "../../../shared/lib/format/user-initials";
import type { CrossAuthorContentRow } from "../../report-sections";
import type { GridAuthor } from "./slide-grid-rows";

const AUTHOR_COLOR_COUNT = 6;

// Reserve the owner's slot 0; foreign authors cycle only through the remaining
// colors so they never silently collide with the owner's swatch.
const FOREIGN_COLOR_COUNT = AUTHOR_COLOR_COUNT - 1;

export interface AuthorRoster {
  readonly owner: GridAuthor;
  // Owner first, then foreign authors sorted by name for the legend.
  readonly authors: readonly GridAuthor[];
}

export function buildContributorRoster(
  sections: readonly ReportSectionReadModel[],
): readonly GridAuthor[] {
  const contributors = new Map(
    sections.map((section) => [section.authorId, section]),
  );
  return [...contributors.values()].map((section, index) => ({
    id: section.authorId,
    name: section.authorName,
    role: section.authorRole,
    initials: initialsFromName(section.authorName),
    colorIndex: index % AUTHOR_COLOR_COUNT,
    isOwner: false,
  }));
}

export function buildAuthorRoster(
  section: ReportSectionReadModel,
  foreign: readonly CrossAuthorContentRow[],
): AuthorRoster {
  const foreignById = new Map(
    foreign
      .filter((row) => row.authorId !== section.authorId)
      .map((row) => [
        row.authorId,
        { name: row.authorName, role: row.authorRole },
      ]),
  );
  const foreignAuthors = [...foreignById.entries()].sort(([, a], [, b]) =>
    a.name.localeCompare(b.name),
  );
  const owner = {
    id: section.authorId,
    name: section.authorName,
    role: section.authorRole,
    initials: initialsFromName(section.authorName),
    colorIndex: 0,
    isOwner: true,
  };
  const authors = [
    owner,
    ...foreignAuthors.map(([id, { name, role }], index) => ({
      id,
      name,
      role,
      initials: initialsFromName(name),
      colorIndex: (index % FOREIGN_COLOR_COUNT) + 1,
      isOwner: false,
    })),
  ];
  return { owner, authors };
}
