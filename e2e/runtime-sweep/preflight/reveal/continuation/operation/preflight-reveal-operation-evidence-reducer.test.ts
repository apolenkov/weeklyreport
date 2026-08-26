import { describe, expect, it } from "vitest";

import { revealRestorationLeaseIdFor } from "../../interaction/evidence/preflight-reveal-operation-recorder.ts";
import type {
  RevealCandidate,
  RevealPureQueueInput,
} from "../../interaction/preflight-reveal-branches.ts";
import {
  DIGEST_LENGTH,
  operationFixture,
  reduceFixture,
  rehashedChunkFor,
} from "./preflight-reveal-operation-evidence-reducer.test-support.ts";
import { expectedRowLocalCohortOperationTotals } from "./preflight-reveal-operation-evidence-reducer.ts";

describe("reveal operation denominator", () => {
  it("derives the exact 20-toggle root, directed-pair, and cohort totals", () => {
    const totals = expectedRowLocalCohortOperationTotals(20);

    expect(totals.root).toMatchObject({
      fullReplayActions: 0,
      candidateActions: 20,
      inverseActions: 0,
      physicalActions: 20,
      chargedActions: 20,
    });
    expect(totals.directedPairs).toMatchObject({
      fullReplayActions: 20,
      candidateActions: 380,
      inverseActions: 360,
      successfulRestorations: 360,
      consumedLeases: 360,
      physicalActions: 760,
      chargedActions: 760,
    });
    expect(totals.cohort).toMatchObject({
      fullReplayActions: 20,
      candidateActions: 400,
      inverseActions: 360,
      physicalActions: 780,
      chargedActions: 780,
    });
  });

  it("rejects a non-cohort denominator", () => {
    expect(() => expectedRowLocalCohortOperationTotals(1)).toThrow(
      /at least two toggles/iu,
    );
  });
});

describe("reveal operation provenance reduction", () => {
  it("accepts a source-bound pair with a parent-derived lease", () => {
    const fixture = operationFixture();
    const result = reduceFixture(fixture);

    expect(result.totals).toMatchObject({
      fullReplayActions: 1,
      candidateActions: 2,
      inverseActions: 1,
      physicalActions: 4,
      chargedActions: 4,
    });
    expect(fixture.operationEvidence.inverseRestorations[0]?.leaseId).toBe(
      revealRestorationLeaseIdFor({
        childExecutionId: fixture.childExecutionId,
        childOrdinal: 0,
        producerCandidateId:
          fixture.operationEvidence.candidateOperations[0]?.candidateId ?? "",
        restorationSequence: 1,
      }),
    );
  });

  it.each([
    ["coupled", { disclosureIndependence: "coupled" as const }],
    ["ordinary", { disclosureIndependence: undefined }],
    ["self", { ariaControls: "row-a" }],
  ])(
    "rejects an ineligible %s consumer after operation rehash",
    (_label, patch) => {
      const fixture = operationFixture();
      const ineligible = {
        ...fixture.consumer,
        control: { ...fixture.consumer.control, ...patch },
      } as unknown as RevealCandidate;
      const queueInput = {
        candidatesFor: () => [fixture.producer, ineligible],
      } as unknown as RevealPureQueueInput;
      const { operationDigest: _operationDigest, ...operationBody } =
        fixture.operationEvidence;
      const chunk = rehashedChunkFor(fixture.chunk, operationBody);

      expect(() => reduceFixture(fixture, queueInput, chunk)).toThrow(
        /consumer|source-bound|row-local|eligible/iu,
      );
    },
  );

  it("rejects a producer that is not source-bound row-local after rehash", () => {
    const fixture = operationFixture();
    const ineligible = {
      ...fixture.producer,
      control: {
        ...fixture.producer.control,
        disclosureIndependence: "coupled",
      },
    } as unknown as RevealCandidate;
    const queueInput = {
      candidatesFor: () => [ineligible, fixture.consumer],
    } as unknown as RevealPureQueueInput;
    const { operationDigest: _operationDigest, ...operationBody } =
      fixture.operationEvidence;

    expect(() =>
      reduceFixture(
        fixture,
        queueInput,
        rehashedChunkFor(fixture.chunk, operationBody),
      ),
    ).toThrow(/producer|source-bound|row-local|eligible/iu);
  });

  it("rejects an arbitrary consumer after operation rehash", () => {
    const fixture = operationFixture();
    const arbitrary: RevealCandidate = {
      ...fixture.consumer,
      control: {
        ...fixture.consumer.control,
        controlKey: "button:arbitrary:1",
      },
    };
    const queueInput = {
      candidatesFor: () => [fixture.producer, arbitrary],
    } as unknown as RevealPureQueueInput;
    const { operationDigest: _operationDigest, ...operationBody } =
      fixture.operationEvidence;

    expect(() =>
      reduceFixture(
        fixture,
        queueInput,
        rehashedChunkFor(fixture.chunk, operationBody),
      ),
    ).toThrow(/candidate|eligible|re-deriv|unavailable/iu);
  });

  it("rejects a foreign lease even when operation bytes are rehashed", () => {
    const fixture = operationFixture();
    const restoration = fixture.operationEvidence.inverseRestorations[0];
    if (restoration === undefined) throw new Error("Fixture lease is missing");
    const { operationDigest: _operationDigest, ...operationBody } =
      fixture.operationEvidence;
    const chunk = rehashedChunkFor(fixture.chunk, {
      ...operationBody,
      inverseRestorations: [
        { ...restoration, leaseId: "f".repeat(DIGEST_LENGTH) },
      ],
    });

    expect(() => reduceFixture(fixture, fixture.queueInput, chunk)).toThrow(
      /lease|provenance/iu,
    );
  });

  it.each(["wrong child", "wrong ordinal"])(
    "rejects a lease derived from a %s context after rehash",
    (label) => {
      const fixture = operationFixture();
      const restoration = fixture.operationEvidence.inverseRestorations[0];
      const producerCandidateId =
        fixture.operationEvidence.candidateOperations[0]?.candidateId;
      if (restoration === undefined || producerCandidateId === undefined)
        throw new Error("Fixture lease producer is missing");
      const { operationDigest: _operationDigest, ...operationBody } =
        fixture.operationEvidence;
      const leaseId = revealRestorationLeaseIdFor({
        childExecutionId:
          label === "wrong child"
            ? "c".repeat(DIGEST_LENGTH)
            : fixture.childExecutionId,
        childOrdinal: label === "wrong ordinal" ? 1 : 0,
        producerCandidateId,
        restorationSequence: 1,
      });
      const chunk = rehashedChunkFor(fixture.chunk, {
        ...operationBody,
        inverseRestorations: [{ ...restoration, leaseId }],
      });

      expect(() => reduceFixture(fixture, fixture.queueInput, chunk)).toThrow(
        /lease|provenance/iu,
      );
    },
  );

  it("rejects a wrong child execution identity after operation rehash", () => {
    const fixture = operationFixture();
    const { operationDigest: _operationDigest, ...operationBody } =
      fixture.operationEvidence;
    const chunk = rehashedChunkFor(fixture.chunk, {
      ...operationBody,
      childExecutionId: "c".repeat(DIGEST_LENGTH),
    });

    expect(() => reduceFixture(fixture, fixture.queueInput, chunk)).toThrow(
      /scope|digest/iu,
    );
  });

  it("rejects a wrong child ordinal after operation rehash", () => {
    const fixture = operationFixture();
    const { operationDigest: _operationDigest, ...operationBody } =
      fixture.operationEvidence;
    const chunk = rehashedChunkFor(fixture.chunk, {
      ...operationBody,
      childOrdinal: 1,
    });

    expect(() => reduceFixture(fixture, fixture.queueInput, chunk)).toThrow(
      /scope|digest/iu,
    );
  });

  it("rejects a wrong predecessor binding after operation rehash", () => {
    const fixture = operationFixture();
    const { operationDigest: _operationDigest, ...operationBody } =
      fixture.operationEvidence;
    const chunk = rehashedChunkFor(fixture.chunk, {
      ...operationBody,
      predecessorOperationDigest: "p".repeat(DIGEST_LENGTH),
    });

    expect(() => reduceFixture(fixture, fixture.queueInput, chunk)).toThrow(
      /scope|digest/iu,
    );
  });

  it("rejects totals that were changed without changing the receipt operations", () => {
    const fixture = operationFixture();
    const { operationDigest: _operationDigest, ...operationBody } =
      fixture.operationEvidence;
    const chunk = rehashedChunkFor(fixture.chunk, {
      ...operationBody,
      summary: {
        ...operationBody.summary,
        chargedActions: operationBody.summary.chargedActions + 1,
      },
    });

    expect(() => reduceFixture(fixture, fixture.queueInput, chunk)).toThrow(
      /totals|debit|drift/iu,
    );
  });

  it("rejects a cross-chunk or foreign consumer binding after rehash", () => {
    const fixture = operationFixture();
    const restoration = fixture.operationEvidence.inverseRestorations[0];
    if (restoration === undefined) throw new Error("Fixture lease is missing");
    const { operationDigest: _operationDigest, ...operationBody } =
      fixture.operationEvidence;
    const chunk = rehashedChunkFor(fixture.chunk, {
      ...operationBody,
      inverseRestorations: [
        {
          ...restoration,
          consumedByReceiptDigest: "x".repeat(DIGEST_LENGTH),
        },
      ],
    });

    expect(() => reduceFixture(fixture, fixture.queueInput, chunk)).toThrow(
      /receipt binding|unavailable|lease/iu,
    );
  });
});
