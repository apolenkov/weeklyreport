import {
  type SearchHit,
  type SearchQueryInput,
  searchQueryInputSchema,
  type SearchQueryOutput,
  searchQueryOutputSchema,
  type UserSession,
} from "@customreport/shared";

import { createServiceLogger } from "../../lib/logger-service.js";

/**
 * SearchRepository contract — Prisma-free at the service
 * boundary so unit tests can supply an in-memory fake. The Prisma
 * implementation lives in search.prisma-repository.ts and uses $queryRaw
 * with `plainto_tsquery('russian', ...)` against the GIN-indexed
 * `searchTsv` columns added in migration 20260506090026.
 */
export interface SearchRepository {
  search(params: {
    q: string;
    /** When 'mine', only rows authored by `userId` are returned (item/risk/
     * decision via reportSection.authorId; project via leadId). When 'all',
     * rows are unfiltered — the service layer enforces the role gate before
     * calling this. When 'published', rows are unfiltered by author but
     * constrained to published reports (`Report.periodStatus = 'published'`)
     * via an INNER JOIN on the item/risk/decision chunks — the viewer's
     * read-parity search surface. */
    scope: "mine" | "all" | "published";
    userId: string;
    /**
     * Group IDs derived via groupScopeFilter logic.
     *   null  → admin; no group filter (see all groups).
     *   [...] → non-admin; filter rows to these reporting-group IDs.
     * An empty array is rejected upstream (early-return empty result) so
     * the repository never receives an empty groupIds array.
     */
    groupIds: string[] | null;
    /**
     * Hit types the caller must never see — their UNION ALL chunk is omitted
     * from the query entirely (not fetched then dropped), so excluded types
     * never consume a slot in the `limit` budget. The service decides this per
     * role; an empty array fetches all types.
     */
    excludeTypes: SearchHit["type"][];
    limit: number;
  }): Promise<SearchHit[]>;
}

export class SearchAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchAuthorizationError";
  }
}

/**
 * Group IDs a session may search within, matching groupScopeFilter semantics:
 *   admin    → null (no group filter; sees all groups)
 *   viewer   → granted viewerGroupAccess (may be empty)
 *   head/lead → own reportingGroupId (may be absent → empty)
 * A non-null empty array means "no group access": the caller short-circuits to
 * a zero-row result rather than querying (groupScopeFilter({ id: { in: [] } })).
 */
function resolveSearchGroupIds(session: UserSession): string[] | null {
  if (session.role === "admin") return null;
  if (session.role === "viewer") return session.viewerGroupAccess ?? [];
  return session.reportingGroupId ? [session.reportingGroupId] : [];
}

/**
 * Hit types a session must never see — their UNION ALL chunk is omitted from the
 * query entirely, so excluded types never consume a slot in the `limit` budget.
 *
 * lead + viewer exclude `project`: the only Project destination is /admin
 * (products), unreachable for both roles, so a project hit dead-ends the search
 * ("Page unavailable for your role"). Their own item/risk/decision hits still
 * surface and deep-link correctly. (lead: behavioral-ui-regression-gate 3.1;
 * viewer: viewer-report-surface-parity Decision 3.)
 */
function resolveSearchExcludeTypes(session: UserSession): SearchHit["type"][] {
  return session.role === "lead" || session.role === "viewer"
    ? ["project"]
    : [];
}

export class SearchService {
  private readonly logger = createServiceLogger("SearchService");

  constructor(private readonly repository: SearchRepository) {}

  /**
   * Run a full-text search across Item / Risk / Decision / Project.
   *
   * Authorization:
   *   - `lead` role + `scope='all'` → SearchAuthorizationError. The router
   *     maps this to TRPCError code FORBIDDEN.
   *   - `head` / `admin` roles can use either scope.
   *   - `viewer` role with `scope='mine'` is technically callable but
   *     returns an empty list because viewers author nothing; `scope='all'`
   *     stays rejected. The viewer's real search surface is
   *     `scope='published'`, which is authorized for every role (it can only
   *     ever surface published, group-scoped content) and exposes exactly the
   *     published reports the viewer can already open.
   *
   * Query sanitisation: we never interpolate `q` into raw SQL. The Prisma
   * repository uses `plainto_tsquery('russian', $1)` which auto-quotes
   * tokens and ignores ts_query operator chars. `q` is also length-bounded
   * (2..200) by the Zod schema.
   */
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
