import { describe, expect, it } from "vitest";

import { revealPathFor, revealSurfaceFor } from "../../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
} from "../preflight-reveal-branches.ts";
import { createRevealOperationRecorder } from "./preflight-reveal-operation-recorder.ts";

const DIGEST_LENGTH = 64;
const proof = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(DIGEST_LENGTH),
  afterDigest: "d".repeat(DIGEST_LENGTH),
};
const inventory = { controls: [], issues: [] } as const;
const branch: RevealBranch = {
  path: revealPathFor([], "/admin"),
  inventory,
  surface: revealSurfaceFor(inventory.controls),
  url: "/admin",
};
const candidateFor = (controlKey: string): RevealCandidate => ({
  control: {
    controlKey,
    domOrderKey: `0000:${controlKey}`,
    order: 0,
    role: "button",
    accessibleName: controlKey,
    enabled: true,
    disabled: false,
    visible: true,
    tagName: "button",
    inputType: null,
    href: null,
  },
  action: {
    controlKey,
    operation: "click",
    safety: "read-only",
    transition: "none",
  },
});
const first = candidateFor("button:first:1"),
  second = candidateFor("button:second:1");

const recorderWithLease = () => {
  const recorder = createRevealOperationRecorder({
    childExecutionId: "e".repeat(DIGEST_LENGTH),
    childOrdinal: 0,
  });
  recorder.recordCandidate({ source: branch, candidate: first });
  const lease = recorder.createRestorationLease({
    source: branch,
    terminal: branch,
    restored: branch,
    candidate: first,
    inverseAction: first.action,
    ariaControlsTarget: "row-first",
    nonMutation: proof,
  });
  return { recorder, lease };
};

describe("reveal operation recorder lease", () => {
  it("seals only after same-recorder immediate consumption", () => {
    const { recorder, lease } = recorderWithLease();

    expect(() => recorder.snapshot()).toThrow(/open restoration boundary/iu);
    recorder.recordCandidate({ source: branch, candidate: second, lease });

    const snapshot = recorder.snapshot();
    expect(snapshot).toMatchObject({
      childOrdinal: 0,
      candidateOperations: [
        { preparation: "FULL_REPLAY", consumedLeaseId: null },
        { preparation: "INVERSE_LEASE", consumedLeaseId: lease.leaseId },
      ],
      inverseRestorations: [{ leaseId: lease.leaseId }],
    });
    expect(snapshot.inverseRestorations[0]?.consumedByCandidateId).toEqual(
      snapshot.candidateOperations[1]?.candidateId,
    );
    expect(() =>
      recorder.recordCandidate({ source: branch, candidate: second, lease }),
    ).toThrow(/stale or cross-recorder/iu);
  });

  it("rejects a lease in a different child recorder", () => {
    const { lease } = recorderWithLease();
    const other = createRevealOperationRecorder({
      childExecutionId: "f".repeat(DIGEST_LENGTH),
      childOrdinal: 1,
    });

    expect(() => other.branchForLease(lease)).toThrow(
      /stale or cross-recorder/iu,
    );
  });

  it("rejects full replay across an open lease", () => {
    const { recorder } = recorderWithLease();

    expect(() => recorder.recordReplayStep("a".repeat(DIGEST_LENGTH))).toThrow(
      /cannot cross an open/iu,
    );
  });
});
