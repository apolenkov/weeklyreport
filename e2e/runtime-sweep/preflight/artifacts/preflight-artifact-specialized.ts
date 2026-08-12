import type { SourceArtifact } from "../../source/source-artifact.ts";
import { stableSerialize } from "../../support/ids.ts";
import type { PreflightArtifact } from "./preflight-artifact.ts";

export type PreflightValidationError = (message: string) => never;

const declarationIdsFor = (
  declarations: readonly Readonly<{ readonly declarationId: string }>[],
): readonly string[] => declarations.map(({ declarationId }) => declarationId);

const compareStrings = (left: string, right: string): number =>
  left.localeCompare(right);

const assertDeclarationCoverage = (
  source: SourceArtifact,
  preflight: PreflightArtifact,
  fail: PreflightValidationError,
): void => {
  const expected = declarationIdsFor(source.specializedDeclarations).toSorted(
    compareStrings,
  );
  const actual = preflight.specializedDeclarations
    .map(({ declarationId }) => declarationId)
    .toSorted(compareStrings);
  if (stableSerialize(expected) !== stableSerialize(actual))
    fail("PREFLIGHT.json specialized declaration coverage is incomplete");
};

const assertSegmentCoverage = (
  source: SourceArtifact,
  preflight: PreflightArtifact,
  fail: PreflightValidationError,
): void => {
  const applicableDeclarations = source.specializedDeclarations.filter(
    (declaration) =>
      source.routes.some(
        (route) =>
          route.role === declaration.role &&
          route.catalogRoute === declaration.catalogRoute,
      ),
  );
  const expected = declarationIdsFor(applicableDeclarations).toSorted(
    compareStrings,
  );
  const actual = preflight.segments.flatMap((segment) =>
    (segment.specialized ?? []).map(({ declarationId }) => declarationId ?? ""),
  );
  if (
    actual.length !== expected.length ||
    new Set(actual).size !== actual.length ||
    stableSerialize(actual.toSorted(compareStrings)) !==
      stableSerialize(expected)
  )
    fail("PREFLIGHT.json specialized segment coverage is incomplete");
};

const assertResolverEntries = (
  source: SourceArtifact,
  preflight: PreflightArtifact,
  fail: PreflightValidationError,
): void => {
  for (const entry of preflight.segments.flatMap(
    (segment) => segment.specialized ?? [],
  ))
    assertResolverEntry(source, entry, fail);
};

const assertResolverEntry = (
  source: SourceArtifact,
  entry: NonNullable<
    PreflightArtifact["segments"][number]["specialized"]
  >[number],
  fail: PreflightValidationError,
): void => {
  const declaration = source.specializedDeclarations.find(
    ({ declarationId }) => declarationId === entry.declarationId,
  );
  if (declaration === undefined)
    fail(
      `PREFLIGHT.json has unknown specialized declaration ${entry.declarationId ?? "none"}`,
    );
  if (declaration.kind !== "resolver") return;
  if (entry.resolverOutcome !== declaration.outcome)
    fail(
      `PREFLIGHT.json resolver outcome is not bound to ${declaration.declarationId}`,
    );
  if (entry.resolverRecoveryOutcome !== declaration.recoveryOutcome)
    fail(
      `PREFLIGHT.json resolver recovery outcome is not bound to ${declaration.declarationId}`,
    );
  const expectedFaultId =
    declaration.executionKind === "fault" ? declaration.faultId : null;
  const actualFaultId =
    entry.execution !== undefined && "faultId" in entry.execution
      ? entry.execution.faultId
      : null;
  if (actualFaultId !== expectedFaultId)
    fail(
      `PREFLIGHT.json resolver fault identity is not bound to ${declaration.declarationId}`,
    );
};

export const assertSpecializedPreflightCoverage = (
  source: SourceArtifact,
  preflight: PreflightArtifact,
  fail: PreflightValidationError,
): void => {
  assertDeclarationCoverage(source, preflight, fail);
  assertSegmentCoverage(source, preflight, fail);
  assertResolverEntries(source, preflight, fail);
};
