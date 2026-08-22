import { describe, expect, it } from "vitest";

import {
  createDiagnosticHostPressureSampler,
  parseDarwinSwapUsage,
  parseDarwinVmStat,
} from "./preflight-diagnostic-host-pressure.ts";

const VM_STAT = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                              10.
Pages occupied by compressor:            4.
Pageins:                                 100.
Pageouts:                                60.
Swapins:                                 12.
Swapouts:                                3.
`;

const SWAP_USAGE =
  "vm.swapusage: total = 7.00G  used = 2.50G  free = 4.50G  (encrypted)";

describe("Darwin diagnostic host pressure", () => {
  it("parses compressed pages and monotonic page counters", () => {
    expect(parseDarwinVmStat(VM_STAT)).toEqual({
      compressedBytes: 65_536,
      pageins: 100,
      pageouts: 60,
      swapins: 12,
      swapouts: 3,
    });
  });

  it("parses swap usage into byte counters", () => {
    expect(parseDarwinSwapUsage(SWAP_USAGE)).toEqual({
      swapTotalBytes: 7 * 1024 ** 3,
      swapUsedBytes: 2.5 * 1024 ** 3,
      swapFreeBytes: 4.5 * 1024 ** 3,
    });
  });

  it("returns null for malformed or incomplete platform output", () => {
    expect(parseDarwinVmStat("Pageins: nope")).toEqual({
      compressedBytes: null,
      pageins: null,
      pageouts: null,
      swapins: null,
      swapouts: null,
    });
    expect(parseDarwinSwapUsage("vm.swapusage: unavailable")).toEqual({
      swapTotalBytes: null,
      swapUsedBytes: null,
      swapFreeBytes: null,
    });
  });

  it("reports deltas only after a prior complete counter snapshot", async () => {
    const outputs = [
      { vmStat: VM_STAT, swapUsage: SWAP_USAGE },
      {
        vmStat: VM_STAT.replace(
          "Pageins:                                 100.",
          "Pageins:                                 105.",
        ).replace(
          "Pageouts:                                60.",
          "Pageouts:                                62.",
        ),
        swapUsage: SWAP_USAGE,
      },
    ];
    let index = 0;
    const sampler = createDiagnosticHostPressureSampler((command) => {
      const output = outputs[index];
      if (output === undefined) throw new Error("unexpected sampler call");
      if (command === "vm_stat") return Promise.resolve(output.vmStat);
      return Promise.resolve(output.swapUsage);
    });

    const first = await sampler.read();
    index = 1;
    const second = await sampler.read();

    expect(first.pageinsDelta).toBeNull();
    expect(first.pageoutsDelta).toBeNull();
    expect(second.pageinsDelta).toBe(5);
    expect(second.pageoutsDelta).toBe(2);
    expect(second.swapinsDelta).toBe(0);
    expect(second.swapoutsDelta).toBe(0);
    expect(second.compressedBytes).toBe(65_536);
  });

  it("nulls a delta when a host counter decreases between snapshots", async () => {
    const outputs = [
      VM_STAT,
      VM_STAT.replace(
        "Pageins:                                 100.",
        "Pageins:                                 90.",
      ),
    ];
    let index = 0;
    const sampler = createDiagnosticHostPressureSampler((command) => {
      if (command === "sysctl") return Promise.resolve(SWAP_USAGE);
      return Promise.resolve(outputs[index] ?? "");
    });

    await sampler.read();
    index = 1;
    const second = await sampler.read();

    expect(second.pageinsDelta).toBeNull();
    expect(second.pageoutsDelta).toBe(0);
  });

  it("keeps unavailable commands nullable instead of hiding the primary failure", async () => {
    const sampler = createDiagnosticHostPressureSampler(() =>
      Promise.reject(new Error("command unavailable")),
    );

    await expect(sampler.read()).resolves.toEqual({
      compressedBytes: null,
      swapTotalBytes: null,
      swapUsedBytes: null,
      swapFreeBytes: null,
      swapinsDelta: null,
      swapoutsDelta: null,
      pageinsDelta: null,
      pageoutsDelta: null,
    });
  });
});
