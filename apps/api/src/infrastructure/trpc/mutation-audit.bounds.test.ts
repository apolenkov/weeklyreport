import { describe, expect, it, vi } from "vitest";

import type { AuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { recordMutationAudit } from "./trpc.audit.js";

function makeAuditSpy(): {
  audit: AuditLogger;
  mutation: ReturnType<typeof vi.fn>;
} {
  const mutation = vi.fn();
  const audit: AuditLogger = {
    ...createNullAuditLogger(),
    mutation,
  };
  return { audit, mutation };
}

const nullLogger = createNullLogger();
const TEST_IP = "test-ip";

// The same 00000000-...-NNNN ids the middleware tests use, as a small
// counter to keep 25 distinct values readable.
const uuid = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// recordMutationAudit is called directly: the bounds live in target
// extraction, so no router, middleware, or prisma client is involved.
async function mutationCall(input: unknown): Promise<Record<string, unknown>> {
  const { audit, mutation } = makeAuditSpy();

  await recordMutationAudit(
    { session: null, logger: nullLogger, auditLogger: audit, ip: TEST_IP },
    {
      procedure: "admin.bulk",
      decodedInput: input,
      status: "success",
      failureCode: null,
      durationMs: 3,
    },
  );

  expect(mutation).toHaveBeenCalledTimes(1);
  const call = mutation.mock.calls[0]?.[0] as
    Record<string, unknown> | undefined;
  return expectDefined(call);
}

describe("recordMutationAudit target extraction bounds", () => {
  it("caps the envelope at 20 targets and flags truncated for 25 distinct ids", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => uuid(i + 1));
    const call = await mutationCall({
      items: ids.map((id) => ({ id })),
    });

    expect(call.targets).toEqual(ids.slice(0, 20));
    expect(call.target).toBe(ids[0]);
    expect(call.truncated).toBe(true);
  });

  it("keeps every target and no truncated flag for a 3-identity input", async () => {
    const ids = [uuid(1), uuid(2), uuid(3)];
    const call = await mutationCall({
      items: ids.map((id) => ({ id })),
    });

    expect(call.targets).toEqual(ids);
    expect(call.target).toBe(ids[0]);
    expect(call).not.toHaveProperty("truncated");
  });

  it("completes a self-referencing input without throwing and keeps the primary target", async () => {
    const sectionId = uuid(30);
    const circular: Record<string, unknown> = { sectionId };
    circular.data = circular;

    const { audit, mutation } = makeAuditSpy();
    await recordMutationAudit(
      { session: null, logger: nullLogger, auditLogger: audit, ip: TEST_IP },
      {
        procedure: "admin.bulk",
        decodedInput: circular,
        status: "success",
        failureCode: null,
        durationMs: 3,
      },
    );

    expect(mutation).toHaveBeenCalledTimes(1);
    const call = mutation.mock.calls[0]?.[0] as
      Record<string, unknown> | undefined;
    expect(call?.target).toBe(sectionId);
  });

  it("treats an identity beyond depth 8 as truncated and keeps a depth-4 identity", async () => {
    const deepId = uuid(31);
    let deep: Record<string, unknown> = { id: deepId };
    for (let level = 0; level < 11; level += 1) deep = { nest: deep };
    const deepCall = await mutationCall({ nest: deep });

    expect(deepCall.targets).toBeUndefined();
    expect(deepCall).not.toHaveProperty("target");
    expect(deepCall.truncated).toBe(true);

    const shallowId = uuid(32);
    const shallowCall = await mutationCall({
      n1: { n2: { n3: { n4: { id: shallowId } } } },
    });

    expect(shallowCall.targets).toEqual([shallowId]);
    expect(shallowCall.target).toBe(shallowId);
    expect(shallowCall).not.toHaveProperty("truncated");
  });
});
