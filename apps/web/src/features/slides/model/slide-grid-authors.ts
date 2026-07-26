import type { ReportSectionReadModel } from "@customreport/shared";

import type { CrossAuthorContentRow } from "../../report-sections";
import type { GridAuthor } from "./slide-grid-rows";

/** Distinct author color tokens before the cycle repeats. */
const AUTHOR_COLOR_COUNT = 6;

/** Foreign authors never take the owner's slot 0 — only the remaining
 * AUTHOR_COLOR_COUNT-1 tokens cycle for them, so a 6th+ foreign author repeats
 * a foreign token instead of silently colliding with the owner's swatch. */
const FOREIGN_COLOR_COUNT = AUTHOR_COLOR_COUNT - 1;

const INITIALS_TOKENS = 2;

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, INITIALS_TOKENS)
    .map((token) => token.charAt(0).toUpperCase())
    .join("");
}

export interface AuthorRoster {
  readonly owner: GridAuthor;
  /** Owner first, foreign authors after in name order — legend order. */
  readonly authors: readonly GridAuthor[];
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
    ...(section.authorRole === undefined ? {} : { role: section.authorRole }),
    initials: initialsOf(section.authorName),
    colorIndex: 0,
    isOwner: true,
  };
  const authors = [
    owner,
    ...foreignAuthors.map(([id, { name, role }], index) => ({
      id,
      name,
      ...(role === undefined ? {} : { role }),
      initials: initialsOf(name),
      colorIndex: (index % FOREIGN_COLOR_COUNT) + 1,
      isOwner: false,
    })),
  ];
  return { owner, authors };
}
