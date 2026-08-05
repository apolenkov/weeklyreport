import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined.js";
import type { Product, StageStatus } from "../types";
import { useStatusRiskSync } from "./use-status-risk";

// A saved risk forces an automatic severity floor on the covering stage.
// The hook is a stage-status applier; interception of conflicting transitions
// lives in lead-form-sync-bridge (see lead-form-sync-bridge.test.tsx).

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

function setup(initialProducts: readonly Product[]) {
  const state = {
    products: [...initialProducts],
    productsCalls: [] as Product[][],
  };

  const onProductsChange = vi.fn(
    (
      next:
        readonly Product[] | ((p: readonly Product[]) => readonly Product[]),
    ) => {
      const resolved = typeof next === "function" ? next(state.products) : next;
      state.products = [...resolved];
      state.productsCalls.push([...resolved]);
    },
  );

  const hookResult = renderHook(() => useStatusRiskSync({ onProductsChange }));

  return { state, hookResult, onProductsChange };
}

describe("useStatusRiskSync", () => {
  it("applies an at-risk status to the selected stage only", () => {
    const product = buildProduct();
    const { state, hookResult } = setup([product]);

    act(() => {
      hookResult.result.current.handleStageStatusChange(
        "crm",
        "Dev",
        "at-risk",
      );
    });

    expect(state.productsCalls).toHaveLength(1);
    const updatedProducts = expectDefined(state.productsCalls[0]);
    const dev = expectDefined(updatedProducts[0]).stages.find(
      (s) => s.stageName === "Dev",
    );
    expect(dev?.status).toBe<StageStatus>("at-risk");
    // Other stages untouched.
    const testing = expectDefined(updatedProducts[0]).stages.find(
      (s) => s.stageName === "Testing",
    );
    expect(testing?.status).toBe<StageStatus>("on-track");
  });

  it("leaves stage statuses unchanged for an unknown product", () => {
    const product = buildProduct();
    const { state, hookResult } = setup([product]);

    act(() => {
      hookResult.result.current.handleStageStatusChange(
        "other",
        "Dev",
        "blocked",
      );
    });

    expect(state.productsCalls).toHaveLength(1);
    const dev = expectDefined(
      expectDefined(state.productsCalls[0])[0],
    ).stages.find((s) => s.stageName === "Dev");
    expect(dev?.status).toBe<StageStatus>("on-track");
  });

  it("applies an on-track status when reverting a stage", () => {
    const product = buildProduct({
      stages: [
        {
          stageName: "Dev",
          status: "at-risk",
          ownership: "mine",
          assignee: "Тимлид 1",
        },
      ],
    });
    const { state, hookResult } = setup([product]);

    act(() => {
      hookResult.result.current.handleStageStatusChange(
        "crm",
        "Dev",
        "on-track",
      );
    });

    expect(state.productsCalls).toHaveLength(1);
    const dev = expectDefined(
      expectDefined(state.productsCalls[0])[0],
    ).stages.find((s) => s.stageName === "Dev");
    expect(dev?.status).toBe<StageStatus>("on-track");
  });
});
