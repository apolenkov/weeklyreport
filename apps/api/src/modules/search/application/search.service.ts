import {
  type SearchHit,
  type SearchQueryInput,
  searchQueryInputSchema,
  type SearchQueryOutput,
  searchQueryOutputSchema,
  type UserSession,
} from "@customreport/shared";

import { computeAllowedGroupIds } from "../../../lib/group-scope.js";
import { type AppLogger, createNullLogger } from "../../../lib/logger.js";

// Prisma-free port so unit tests supply an in-memory fake; Prisma impl uses
// $queryRaw + plainto_tsquery against GIN-indexed searchTsv columns.
export interface SearchRepository {
  readonly search: (params: {
    readonly q: string;
    // 'all' is unfiltered — the service layer enforces the role gate before
    // calling. 'published' reads only immutable publication snapshots.
    readonly scope: "mine" | "all" | "published";
    readonly userId: string;
    // null → no group filter (admin). An empty array never reaches here: the
    // service short-circuits it to a zero-row result.
    readonly groupIds: readonly string[] | null;
    // Excluded types' UNION ALL chunk is omitted from the query entirely, so
    // they never consume a slot in the `limit` budget.
    readonly excludeTypes: readonly SearchHit["type"][];
    readonly limit: number;
  }) => Promise<readonly SearchHit[]>;
}

export class SearchAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchAuthorizationError";
  }
}

// Search keeps the repository's null-vs-empty contract: admin is unscoped,
// while an empty computed scope short-circuits to zero rows.
function resolveSearchGroupIds(session: UserSession): readonly string[] | null {
  if (session.role === "admin") return null;
  return computeAllowedGroupIds(session);
}

// lead + viewer exclude `project`: the only Project destination is /admin,
// unreachable for both roles, so a project hit would dead-end the search.
function resolveSearchExcludeTypes(
  session: UserSession,
): readonly SearchHit["type"][] {
  return session.role === "lead" || session.role === "viewer"
    ? ["project"]
    : [];
}

export class SearchService {
  constructor(
    private readonly repository: SearchRepository,
    private readonly logger: AppLogger = createNullLogger(),
  ) {}

  // Viewers are confined to immutable published search. `scope='all'` remains
  // head/admin-only; lead/head/admin retain their existing mine/all behavior.
  async query(
    input: SearchQueryInput,
    session: UserSession,
  ): Promise<SearchQueryOutput> {
    const parsed = searchQueryInputSchema.parse(input);

    if (session.role === "viewer" && parsed.scope !== "published") {
      throw new SearchAuthorizationError(
        'viewer sessions require scope="published"',
      );
    }

    if (
      parsed.scope === "all" &&
      session.role !== "head" &&
      session.role !== "admin"
    ) {
      throw new SearchAuthorizationError(
        'scope="all" is restricted to head and admin sessions',
      );
    }

    const groupIds = resolveSearchGroupIds(session);
    if (groupIds !== null && groupIds.length === 0) {
      return searchQueryOutputSchema.parse([]);
    }

    const hits = await this.repository.search({
      q: parsed.q,
      scope: parsed.scope,
      userId: session.userId,
      groupIds,
      excludeTypes: resolveSearchExcludeTypes(session),
      limit: parsed.limit,
    });

    // Server-side ordering: rank desc, then createdAt desc, then id asc as a
    // stable tie-breaker so equal-rank rows don't shuffle between calls.
    const sorted = [...hits].sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      if (b.createdAt !== a.createdAt)
        return b.createdAt.localeCompare(a.createdAt);
      return a.id.localeCompare(b.id);
    });

    const limited = sorted.slice(0, parsed.limit);
    this.logger.info("search executed", {
      scope: parsed.scope,
      role: session.role,
      hits: limited.length,
    });
    return searchQueryOutputSchema.parse(limited);
  }
}
