import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { sha256Hex } from "../../../support/ids.ts";
import { revealPathFor, revealStepFor } from "../../reveal-path.ts";
import {
  controlFor,
  inventoryFor,
} from "../continuation/preflight-reveal-continuation-fixture.ts";
import {
  fixtures,
  fixturesFor,
  surfaceFor,
} from "../guards/preflight-reveal-pair-diagnosis-fixtures.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealDiscoveryState,
} from "../interaction/preflight-reveal-branches.ts";
import { revealCandidateIdentityFor } from "../interaction/preflight-reveal-candidate-identity.ts";
import type { RevealRoute } from "../interaction/preflight-reveal-types.ts";
import type { SourceBoundCapacityFrontierInput } from "./preflight-reveal-capacity-frontier-adapter-contract.ts";
import {
  continuationArtifactsFor,
  fixtureFor,
} from "./preflight-reveal-capacity-frontier-test-fixture.ts";
import {
  capacityPlanFor,
  routeStateFor,
} from "./preflight-reveal-capacity-frontier-test-support.ts";
import {
  captureRevealFailureFrontier,
  readRevealFailureFrontierPacket,
} from "./preflight-reveal-failure-frontier-io.ts";

const fullPendingBranchFor = (input: {
  readonly current: RevealBranch;
  readonly candidate: RevealCandidate;
}): RevealBranch => {
  const pendingUrl = input.current.url;
  const pendingSurface = surfaceFor(["a", "b", "c", "d"]);
  return {
    path: revealPathFor(
      [
        ...input.current.path.steps,
        revealStepFor(
          input.candidate.action,
          input.current.surface,
          pendingSurface,
          input.current.url,
          pendingUrl,
          {
            status: "unchanged",
            beforeDigest: sha256Hex("full-capacity-non-mutation"),
            afterDigest: sha256Hex("full-capacity-non-mutation"),
          },
        ),
      ],
      input.current.path.initialUrl,
    ),
    inventory: inventoryFor([controlFor("d", "Disclosure D", 0)]),
    surface: pendingSurface,
    url: pendingUrl,
    preparation: undefined,
  };
};

const fullFrontierFor = (input: {
  readonly base: Awaited<ReturnType<typeof fixtureFor>>;
  readonly route: RevealRoute;
}): Readonly<{
  readonly alternateBranch: RevealBranch;
  readonly candidate: RevealCandidate;
  readonly candidates: readonly RevealCandidate[];
  readonly current: RevealBranch;
  readonly initialState: RevealDiscoveryState;
  readonly pendingBranch: RevealBranch;
  readonly queueInput: Awaited<
    ReturnType<typeof fixtureFor>
  >["input"]["queueInput"];
}> => {
  const pairFixtures = fixtures();
  const fullPairFixtures = fixturesFor(["a", "b", "c", "d"]);
  const alternateBranch = fixturesFor(["a", "b", "d", "c"]).candidate;
  const current = pairFixtures.candidate;
  const templateCandidate =
    input.base.input.initialState.currentCandidates?.[0];
  if (templateCandidate === undefined)
    throw new Error("Full fixture candidate is missing");
  const candidate: RevealCandidate = {
    ...templateCandidate,
    control: {
      ...templateCandidate.control,
      controlKey: "d",
      domOrderKey: "0000:d",
      accessibleName: "Disclosure D",
    },
    action: { ...templateCandidate.action, controlKey: "d" },
  };
  const candidates: readonly RevealCandidate[] = [candidate];
  const pendingBranch = fullPendingBranchFor({ current, candidate });
  const initialState: RevealDiscoveryState = {
    ...input.base.input.initialState,
    queue: [
      ...fullPairFixtures.singles,
      ...fullPairFixtures.pairs,
      alternateBranch,
    ],
    currentBranch: current,
    currentCandidates: candidates,
    currentCandidateIndex: 0,
  };
  const queueInput = {
    ...input.base.input.queueInput,
    route: input.route,
    initialSurface: current.surface,
  };
  return {
    alternateBranch,
    candidate,
    candidates,
    current,
    initialState,
    pendingBranch,
    queueInput,
  };
};

export const fullReductionFixtureFor = async () => {
  const base = await fixtureFor();
  await rm(base.packetRoot, { recursive: true, force: true });
  const source = base.input.source;
  const { route } = routeStateFor(source);
  const sourceState = source.plan.states.find(
    (state) => state.stateId === base.input.queueInput.state.stateId,
  );
  if (sourceState === undefined)
    throw new Error("Full fixture state is missing");
  const frontier = fullFrontierFor({ base, route });
  const plan = capacityPlanFor({
    source,
    state: sourceState,
    route,
    queueInput: frontier.queueInput,
  });
  const { bootstrap, parentPass } = continuationArtifactsFor({
    source,
    state: sourceState,
    route,
    queueInput: frontier.queueInput,
    discoveryState: frontier.initialState,
    branch: frontier.current,
    candidates: frontier.candidates,
  });
  const packetRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "capacity-frontier-full-")),
  );
  await captureRevealFailureFrontier({
    packetRoot,
    plan,
    failure: {
      state: frontier.initialState,
      branch: frontier.current,
      pendingBranch: frontier.pendingBranch,
      candidates: frontier.candidates,
      candidateIndex: 0,
      candidateIdentity: revealCandidateIdentityFor({
        branch: frontier.current,
        candidate: frontier.candidate,
      }),
      originalError: new Error("full frontier candidate failed"),
    },
  });
  const input: SourceBoundCapacityFrontierInput = {
    source,
    packet: await readRevealFailureFrontierPacket({
      packetRoot,
      expectedPlan: plan,
    }),
    capacityPlanArtifactDigest: plan.planArtifactDigest,
    capacityPlanSelectorDigest: plan.selector.selectorDigest,
    queueInput: frontier.queueInput,
    initialState: frontier.initialState,
    receipts: [],
    bootstrap,
    parentPass,
  };
  return {
    fixture: base.fixture,
    input,
    packetRoot,
    plan,
    alternateBranch: frontier.alternateBranch,
  };
};
