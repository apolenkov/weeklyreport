import { z } from "zod";

import {
  type CoverageCell,
  roleSchema,
  seedProfileSchema,
  sourceShaSchema,
} from "./contracts.ts";
import type { AiDriverReport } from "./driver-results-contract.ts";
import type { EnvironmentFeedback } from "./environment-feedback.ts";

export type DriverCandidate = AiDriverReport["candidates"][number];
const verificationStatusSchema = z.enum(["confirmed", "dismissed"]);
export const candidateVerificationSchema = z
  .object({
    candidateId: z.string().min(1),
    cellId: z.string().min(1),
    sourceSha: sourceShaSchema,
    status: verificationStatusSchema,
    verifierRef: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export type CandidateVerification = z.infer<typeof candidateVerificationSchema>;
export interface CandidateVerificationContext {
  readonly sourceSha: string;
  readonly profile: z.infer<typeof seedProfileSchema>;
  readonly role: z.infer<typeof roleSchema>;
  readonly repoRoot: string;
}
export type CandidateVerifier = (
  candidate: DriverCandidate,
  context: CandidateVerificationContext,
) => Promise<unknown>;
export type VerifiedCandidate = Readonly<{
  readonly candidate: DriverCandidate;
  readonly verification: CandidateVerification;
}>;
export type CandidateVerificationSummary = Readonly<{
  readonly confirmed: readonly VerifiedCandidate[];
  readonly dismissed: readonly VerifiedCandidate[];
  readonly verifications: readonly CandidateVerification[];
}>;

export class CandidateVerificationError extends Error {
  override readonly name = "CandidateVerificationError";

  constructor(readonly issues: readonly string[]) {
    super(`Candidate verification blocked adjudication: ${issues.join("; ")}`);
  }
}

export function parseCandidateVerification(
  value: unknown,
  expected: Readonly<{
    readonly candidate: DriverCandidate;
    readonly sourceSha: string;
  }>,
): CandidateVerification {
  const parsed = candidateVerificationSchema.safeParse(value);
  if (!parsed.success)
    throw new CandidateVerificationError(
      parsed.error.issues.map((issue) => issue.message),
    );
  const issues = [
    ...(parsed.data.candidateId !== expected.candidate.candidateId
      ? ["verifier candidate id is stale"]
      : []),
    ...(parsed.data.cellId !== expected.candidate.cellId
      ? ["verifier cell id is stale"]
      : []),
    ...(parsed.data.sourceSha !== expected.sourceSha
      ? ["verifier source SHA is stale"]
      : []),
  ];
  if (issues.length > 0) throw new CandidateVerificationError(issues);
  return parsed.data;
}

export function createImportedCandidateVerifier(
  values: readonly unknown[],
  expectedCandidates: readonly DriverCandidate[],
): CandidateVerifier {
  const parsed = values.map((value) => {
    const result = candidateVerificationSchema.safeParse(value);
    if (!result.success)
      throw new CandidateVerificationError(
        result.error.issues.map((issue) => issue.message),
      );
    return result.data;
  });
  const duplicateIds = parsed
    .map(({ candidateId }) => candidateId)
    .filter((candidateId, index, ids) => ids.indexOf(candidateId) !== index);
  if (duplicateIds.length > 0)
    throw new CandidateVerificationError(
      [...new Set(duplicateIds)].map(
        (candidateId) => `duplicate imported verification ${candidateId}`,
      ),
    );
  const expectedIds = expectedCandidates.map(({ candidateId }) => candidateId);
  const importedIds = parsed.map(({ candidateId }) => candidateId);
  const expected = new Set(expectedIds);
  const imported = new Set(importedIds);
  const identityIssues = [
    ...expectedIds
      .filter((candidateId) => !imported.has(candidateId))
      .map((candidateId) => `missing imported verification ${candidateId}`),
    ...importedIds
      .filter((candidateId) => !expected.has(candidateId))
      .map((candidateId) => `unused imported verification ${candidateId}`),
  ];
  if (identityIssues.length > 0)
    throw new CandidateVerificationError(identityIssues);
  const byCandidateId = new Map(
    parsed.map((verification) => [verification.candidateId, verification]),
  );
  return (candidate, context) => {
    const verification = byCandidateId.get(candidate.candidateId);
    if (!verification)
      throw new CandidateVerificationError([
        `missing imported verification ${candidate.candidateId}`,
      ]);
    return Promise.resolve(
      parseCandidateVerification(verification, {
        candidate,
        sourceSha: context.sourceSha,
      }),
    );
  };
}

async function verifyOne(
  candidate: DriverCandidate,
  context: CandidateVerificationContext,
  verifier: CandidateVerifier,
): Promise<CandidateVerification> {
  try {
    const raw = await verifier(candidate, context);
    const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parseCandidateVerification(value, {
      candidate,
      sourceSha: context.sourceSha,
    });
  } catch (error) {
    if (error instanceof CandidateVerificationError) throw error;
    if (error instanceof Error)
      throw new CandidateVerificationError([error.message]);
    throw error;
  }
}

export async function verifyDriverCandidates(
  candidates: readonly DriverCandidate[],
  context: CandidateVerificationContext,
  verifier: CandidateVerifier,
): Promise<CandidateVerificationSummary> {
  if (!sourceShaSchema.safeParse(context.sourceSha).success)
    throw new CandidateVerificationError(["campaign source SHA is malformed"]);
  const uniqueIds = new Set<string>();
  const duplicateIds = candidates
    .map(({ candidateId }) => candidateId)
    .filter((candidateId) => {
      const duplicate = uniqueIds.has(candidateId);
      uniqueIds.add(candidateId);
      return duplicate;
    });
  if (duplicateIds.length > 0)
    throw new CandidateVerificationError(
      duplicateIds.map((candidateId) => `duplicate candidate ${candidateId}`),
    );
  const verifications = await candidates.reduce<
    Promise<readonly CandidateVerification[]>
  >(
    async (pending, candidate) => [
      ...(await pending),
      await verifyOne(candidate, context, verifier),
    ],
    Promise.resolve([]),
  );
  const pairs = candidates.map((candidate, index) => ({
    candidate,
    verification: verifications[index],
  }));
  const confirmed = pairs.filter(
    (pair): pair is VerifiedCandidate =>
      pair.verification?.status === "confirmed",
  );
  const dismissed = pairs.filter(
    (pair): pair is VerifiedCandidate =>
      pair.verification?.status === "dismissed",
  );
  return { confirmed, dismissed, verifications };
}

export function appendEnvironmentCandidates(
  report: AiDriverReport,
  feedback: EnvironmentFeedback,
  cells: readonly CoverageCell[],
): AiDriverReport {
  const existingIds = new Set(
    report.candidates.map(({ candidateId }) => candidateId),
  );
  const environmentCandidates = feedback.hits.flatMap((hit) => {
    const cell = hit.cellId
      ? cells.find(({ cellId }) => cellId === hit.cellId)
      : cells.find(
          ({ catalogRoute, resolvedRoute }) =>
            catalogRoute === hit.route || resolvedRoute === hit.route,
        );
    const candidateId = `environment-${hit.eventId}`;
    if (!cell || existingIds.has(candidateId)) return [];
    return [
      {
        candidateId,
        cellId: cell.cellId,
        controlKey: cell.action.controlKey,
        kind: "env" as const,
        summary: `${hit.channel}: ${hit.message}`,
        evidenceRefs: hit.evidenceRefs,
      },
    ];
  });
  return {
    ...report,
    candidates: [...report.candidates, ...environmentCandidates],
  };
}
