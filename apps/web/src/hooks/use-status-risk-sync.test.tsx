import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  Product,
  RiskEntry,
  StageStatus,
} from "../components/lead/mock-data";
import { expectDefined } from "../test-utils/expect-defined.js";
import { type SyncSource, useStatusRiskSync } from "./use-status-risk-sync";

function buildProduct(overrides?: Partial<Product>): Product {
  return {
    id: "crm",
    name: "CRM Platform",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Planning",
        status: "on-track",
        ownership: "locked",
        assignee: "PM",
      },
      {
        stageName: "Dev",
        status: "on-track",
        ownership: "mine",
        assignee: "Тимлид 1",
      },
      {
        stageName: "Testing",
        status: "on-track",
        ownership: "mine",
        assignee: "Тимлид 1",
      },
    ],
    ...overrides,
  };
}

type HookSetup = {
  products: Product[];
  risks: RiskEntry[];
  productsCalls: Array<Product[]>;
  risksCalls: Array<RiskEntry[]>;
  confirmationCalls: Array<{
    productId: string;
    productName: string;
    stageName: string;
    suggestedStatus: "at-risk" | "blocked";
  }>;
};

function setup(initialProducts: Product[], initialRisks: RiskEntry[]) {
  const state: HookSetup = {
    products: initialProducts,
    risks: initialRisks,
    productsCalls: [],
    risksCalls: [],
    confirmationCalls: [],
  };

  const onProductsChange = vi.fn(
    (next: Product[] | ((p: Product[]) => Product[])) => {
      const resolved =
        typeof next === "function"
          ? (next as (p: Product[]) => Product[])(state.products)
          : next;
      state.products = resolved;
      state.productsCalls.push(resolved);
    },
  );

  const onRisksChange = vi.fn(
    (next: RiskEntry[] | ((r: RiskEntry[]) => RiskEntry[])) => {
      const resolved =
        typeof next === "function"
          ? (next as (r: RiskEntry[]) => RiskEntry[])(state.risks)
          : next;
      state.risks = resolved;
      state.risksCalls.push(resolved);
    },
  );

  const requestStatusUpdateConfirmation = vi.fn(
    (params: {
      productId: string;
      productName: string;
      stageName: string;
      suggestedStatus: "at-risk" | "blocked";
    }) => {
      state.confirmationCalls.push(params);
    },
  );

  const hookResult = renderHook(
    ({ products, risks }: { products: Product[]; risks: RiskEntry[] }) =>
      useStatusRiskSync({
        products,
        risks,
        onProductsChange,
        onRisksChange,
        requestStatusUpdateConfirmation,
      }),
    {
      initialProps: { products: state.products, risks: state.risks },
    },
  );

  return {
    state,
    hookResult,
    onProductsChange,
    onRisksChange,
    requestStatusUpdateConfirmation,
  };
}

describe("useStatusRiskSync", () => {
  it("Test 1 (SYNC-01 simplified): user sets stage to at-risk -> updates products only, NO auto-added risk row", () => {
    // Earlier the hook auto-appended an empty risk row whenever a stage
    // flipped to at-risk/blocked. The phantom "— pending" row that
    // surfaced in the Risks list was confusing, and the unbacked-stage
    // warning banner already carries the "describe this" signal without
    // mutating the data model. Stage -> Risk auto-add was removed.
    const product = buildProduct();
    const { state, hookResult } = setup([product], []);

    act(() => {
      hookResult.result.current.handleStageStatusChange(
        "crm",
        "Dev",
        "at-risk",
      );
    });

    // products updated to mark Dev as at-risk
    expect(state.productsCalls).toHaveLength(1);
    const updatedProducts = expectDefined(state.productsCalls[0]);
    const dev = expectDefined(updatedProducts[0]).stages.find(
      (s) => s.stageName === "Dev",
    );
    expect(dev?.status).toBe<StageStatus>("at-risk");

    // risks: NOT touched — the warning banner is the sole signal now.
    expect(state.risksCalls).toHaveLength(0);
  });

  it("Test 2 (SYNC-01 idempotency): existing risk + status flip still leaves risks untouched", () => {
    const product = buildProduct();
    const existingRisk: RiskEntry = {
      id: "r-existing",
      productId: "crm",
      productName: "CRM Platform",
      stageName: "Dev",
      severity: "at-risk",
      text: "pre-existing",
      impact: "",
      mitigation: "",
    };
    const { state, hookResult } = setup([product], [existingRisk]);

    act(() => {
      hookResult.result.current.handleStageStatusChange(
        "crm",
        "Dev",
        "blocked",
      );
    });

    // products fired once (status update)
    expect(state.productsCalls).toHaveLength(1);
    // risks did NOT fire (hook never mutates risks on stage change anymore)
    expect(state.risksCalls).toHaveLength(0);
  });

  it("Test 3 (SYNC-04): when source is auto-sync, handleRiskFilled is a no-op (loop guard)", () => {
    const product = buildProduct();
    const risk: RiskEntry = {
      id: "r1",
      productId: "crm",
      productName: "CRM Platform",
      stageName: "Dev",
      severity: "at-risk",
      impact: "",
      mitigation: "",
      text: "",
    };
    const { state, hookResult } = setup([product], [risk]);

    act(() => {
      hookResult.result.current.handleRiskFilled(
        "r1",
        "auto-sync" satisfies SyncSource,
      );
    });

    // No confirmation requested when auto-sync triggers risk fill
    expect(state.confirmationCalls).toHaveLength(0);
    // No products mutation
    expect(state.productsCalls).toHaveLength(0);
  });

  it("Test 4 (SYNC-03): user fills risk on on-track stage -> requests confirmation, does NOT mutate stage", () => {
    const product = buildProduct({
      stages: [
        {
          stageName: "Planning",
          status: "on-track",
          ownership: "locked",
          assignee: "PM",
        },
        {
          stageName: "Dev",
          status: "on-track",
          ownership: "mine",
          assignee: "Тимлид 1",
        },
      ],
    });
    const risk: RiskEntry = {
      id: "r1",
      productId: "crm",
      productName: "CRM Platform",
      stageName: "Dev",
      severity: "at-risk",
      impact: "",
      mitigation: "",
      text: "something bad",
    };
    const { state, hookResult } = setup([product], [risk]);

    act(() => {
      hookResult.result.current.handleRiskFilled("r1", "user");
    });

    expect(state.confirmationCalls).toHaveLength(1);
    expect(state.confirmationCalls[0]).toEqual({
      productId: "crm",
      productName: "CRM Platform",
      stageName: "Dev",
      suggestedStatus: "at-risk",
    });
    // Hook does NOT directly mutate stage; consumer applies on confirm
    expect(state.productsCalls).toHaveLength(0);
  });

  it("Test 5 (SYNC-03): applyStatusSuggestion fires onProductsChange with auto-sync source (no inverse trigger)", () => {
    const product = buildProduct();
    const { state, hookResult } = setup([product], []);

    act(() => {
      hookResult.result.current.applyStatusSuggestion("crm", "Dev", "at-risk");
    });

    // products updated
    expect(state.productsCalls).toHaveLength(1);
    const dev = expectDefined(
      expectDefined(state.productsCalls[0])[0],
    ).stages.find((s) => s.stageName === "Dev");
    expect(dev?.status).toBe<StageStatus>("at-risk");
    // risks NOT fired because source was auto-sync (skips inverse trigger)
    expect(state.risksCalls).toHaveLength(0);
  });

  it("Test 6 (loop guard): auto-sync handleRiskFilled never triggers confirmation", () => {
    // Previously this asserted the no-loop invariant after the hook auto-
    // created a risk. With auto-add removed, the only thing left to
    // verify is that handleRiskFilled with source='auto-sync' is a no-op
    // — which Test 3 already covers. This test now exercises the same
    // guard with a pre-existing risk to keep the source-based short-
    // circuit behaviour pinned.
    const product = buildProduct();
    const risk: RiskEntry = {
      id: "r-pre",
      productId: "crm",
      productName: "CRM Platform",
      stageName: "Dev",
      severity: "at-risk",
      impact: "",
      mitigation: "",
      text: "",
    };
    const { state, hookResult } = setup([product], [risk]);

    act(() => {
      hookResult.result.current.handleRiskFilled("r-pre", "auto-sync");
    });

    expect(state.confirmationCalls).toHaveLength(0);
    expect(state.productsCalls).toHaveLength(0);
  });

  it("Test 7 (revert to on-track): hook updates stage but does NOT delete the bound risk", () => {
    const product = buildProduct({
      stages: [
        {
          stageName: "Planning",
          status: "on-track",
          ownership: "locked",
          assignee: "PM",
        },
        {
          stageName: "Dev",
          status: "at-risk",
          ownership: "mine",
          assignee: "Тимлид 1",
        },
      ],
    });
    const risk: RiskEntry = {
      id: "r1",
      productId: "crm",
      productName: "CRM Platform",
      stageName: "Dev",
      severity: "at-risk",
      impact: "",
      mitigation: "",
      text: "existing context",
    };
    const { state, hookResult } = setup([product], [risk]);

    act(() => {
      hookResult.result.current.handleStageStatusChange(
        "crm",
        "Dev",
        "on-track",
        "user",
      );
    });

    // products fired with the stage now on-track
    expect(state.productsCalls).toHaveLength(1);
    const dev = expectDefined(
      expectDefined(state.productsCalls[0])[0],
    ).stages.find((s) => s.stageName === "Dev");
    expect(dev?.status).toBe<StageStatus>("on-track");
    // risks did NOT fire — risk preserved per AF-4 (no auto-delete)
    expect(state.risksCalls).toHaveLength(0);
  });
});
