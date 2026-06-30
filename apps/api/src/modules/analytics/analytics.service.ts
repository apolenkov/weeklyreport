import {
  type LeadVelocityInput,
  leadVelocityInputSchema,
  type LeadVelocityOutput,
  leadVelocityOutputSchema,
  type PeriodComparisonInput,
  periodComparisonInputSchema,
  type PeriodComparisonOutput,
  periodComparisonOutputSchema,
  type TrafficLightHistoryInput,
  trafficLightHistoryInputSchema,
  type TrafficLightHistoryOutput,
  trafficLightHistoryOutputSchema,
  type UserSession,
} from "@customreport/shared";

import { scopeDiscriminator } from "../../lib/group-scope.js";

/**
 * AnalyticsRepository contract — Prisma-free at the service boundary so the
 * domain stays test-friendly. The Prisma implementation lives in
 * analytics.prisma-repository.ts.
 *
 * Every read takes the caller `session`: analytics aggregates the contents of a
 * unified period's sections, which span all groups, so each query MUST be bound
 * to the caller's group scope (see analytics.prisma-repository.ts).
 */
export interface AnalyticsRepository {
  trafficLightHistory(
    input: TrafficLightHistoryInput,
    session: UserSession,
  ): Promise<TrafficLightHistoryOutput>;
  leadVelocity(
    input: LeadVelocityInput,
    session: UserSession,
  ): Promise<LeadVelocityOutput>;
  periodComparison(
    input: PeriodComparisonInput,
    session: UserSession,
  ): Promise<PeriodComparisonOutput>;
}

/**
 * Cache port — Phase 30-01 wraps Redis behind this minimal interface so unit
 * tests can supply an in-memory fake (the real Redis client is opt-in via
 * AnalyticsCache in analytics.cache.ts).
 */
export interface AnalyticsCachePort {
  getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

// Phase 32-C / M-04: namespace under `customreport:` so analytics keys do not
// collide with other applications sharing the Redis instance. The cache's
// SCAN-based invalidation (analytics.cache.ts) walks the same prefix, so all
// three sub-prefixes must remain on the `customreport:analytics:` root.
const PREFIX_HISTORY = "customreport:analytics:traffic-light:";
const PREFIX_VELOCITY = "customreport:analytics:lead-velocity:";
const PREFIX_COMPARISON = "customreport:analytics:period-comparison:";

/**
 * Stable JSON.stringify with sorted keys so equivalent inputs hit the same
 * cache key regardless of property order in the call site.
 */
function stableHash(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  // eslint-disable-next-line sonarjs/no-alphabetical-sort -- stable cache-key hashing; localeCompare would break determinism across locales
  const keys = Object.keys(value).sort();
  return JSON.stringify(value, keys);
}

export class AnalyticsService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly cache: AnalyticsCachePort,
  ) {}

  async trafficLightHistory(
    input: TrafficLightHistoryInput,
    session: UserSession,
  ): Promise<TrafficLightHistoryOutput> {
    const parsed = trafficLightHistoryInputSchema.parse(input);
    const key = `${PREFIX_HISTORY}${scopeDiscriminator(session)}:${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(key, () =>
      this.repository.trafficLightHistory(parsed, session),
    );
    return trafficLightHistoryOutputSchema.parse(result);
  }

  async leadVelocity(
    input: LeadVelocityInput,
    session: UserSession,
  ): Promise<LeadVelocityOutput> {
    const parsed = leadVelocityInputSchema.parse(input);
    const key = `${PREFIX_VELOCITY}${scopeDiscriminator(session)}:${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(key, () =>
      this.repository.leadVelocity(parsed, session),
    );
    return leadVelocityOutputSchema.parse(result);
  }

  async periodComparison(
    input: PeriodComparisonInput,
    session: UserSession,
  ): Promise<PeriodComparisonOutput> {
    const parsed = periodComparisonInputSchema.parse(input);
    const key = `${PREFIX_COMPARISON}${scopeDiscriminator(session)}:${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(key, () =>
      this.repository.periodComparison(parsed, session),
    );
    return periodComparisonOutputSchema.parse(result);
  }
}
