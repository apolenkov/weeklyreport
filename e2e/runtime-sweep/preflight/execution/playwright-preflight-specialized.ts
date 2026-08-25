import {
  assertSpecializedDeclarations,
  SPECIALIZED_DECLARATIONS,
  type SpecializedDeclaration,
} from "../../matrix/specialized/specialized-declarations.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";

export type PreflightErrorFactory = (message: string) => Error;

export const declarationsForSource = (
  source: SourceArtifact,
  createError: PreflightErrorFactory,
): readonly SpecializedDeclaration[] => {
  assertSpecializedDeclarations(source.specializedDeclarations);
  return source.specializedDeclarations.flatMap((declaration) => {
    const routeDeclared = source.routes.some(
      (route) =>
        route.role === declaration.role &&
        route.catalogRoute === declaration.catalogRoute,
    );
    if (!routeDeclared) return [];
    const known = SPECIALIZED_DECLARATIONS.find(
      ({ declarationId }) => declarationId === declaration.declarationId,
    );
    if (known === undefined)
      throw createError(
        `Unknown specialized declaration ${declaration.declarationId}`,
      );
    return [declaration];
  });
};

const nominalStateFor = (
  source: SourceArtifact,
  declaration: SpecializedDeclaration,
  createError: PreflightErrorFactory,
): SourceArtifact["plan"]["states"][number] => {
  const routeKey = `${declaration.role}:${declaration.catalogRoute}`;
  const state = source.plan.states.find(
    (candidate) =>
      candidate.profile === declaration.profile &&
      candidate.axes.route === routeKey &&
      candidate.axes.lifecycle === "open" &&
      candidate.axes.submission === "draft" &&
      candidate.axes.ownershipDensity === "single" &&
      candidate.axes.permission === "allowed",
  );
  if (state === undefined)
    throw createError(
      `Specialized declaration ${declaration.declarationId} has no nominal target state`,
    );
  return state;
};

export const assertSpecializedNominalTargets = (
  source: SourceArtifact,
  createError: PreflightErrorFactory = (message) => new Error(message),
): void => {
  declarationsForSource(source, createError).forEach((declaration) => {
    nominalStateFor(source, declaration, createError);
  });
};
