import {
  type SearchHit,
  type SearchQueryInput,
  searchQueryInputSchema,
  type SearchQueryOutput,
  searchQueryOutputSchema,
  type UserSession,
} from "@customreport/shared";

import { createServiceLogger } from "../../lib/logger-service.js";

// Prisma-free port so unit tests supply an in-memory fake; Prisma impl uses
// $queryRaw + plainto_tsquery against GIN-indexed searchTsv columns.
export interface SearchRepository {
  readonly search: (params: {
    readonly q: string;
    // 'all' is unfiltered — the service layer enforces the role gate before
    // calling. 'published' INNER JOINs `Report.periodStatus = 'published'`:
    // the viewer's read-parity surface (openspec/specs/viewer-published-search).
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

// Mirrors groupScopeFilter semantics. A non-null empty array means "no group
// access" — the caller short-circuits to zero rows rather than querying.
function resolveSearchGroupIds(session: UserSession): readonly string[] | null {
  if (session.role === "admin") return null;
  if (session.role === "viewer") return session.viewerGroupAccess ?? [];
  return session.reportingGroupId ? [session.reportingGroupId] : [];
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
  private readonly logger = createServiceLogger("SearchService");

  constructor(private readonly repository: SearchRepository) {}

  // `scope='all'` is head/admin only; `scope='published'` is open to every role
  // because it can only ever surface published, group-scoped content — that is
  // the viewer's real surface (openspec/specs/search-contract-precision).
  async query(
    input: SearchQueryInput,
    session: UserSession,
  ): Promise<SearchQueryOutput> {
    const parsed = searchQueryInputSchema.parse(input);

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

    // Server-side ordering: rank desc, then createdAt desc as a stable tie-
    // breaker so two equal-rank rows don't shuffle between calls.
    const sorted = [...hits].sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      return b.createdAt.localeCompare(a.createdAt);
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
