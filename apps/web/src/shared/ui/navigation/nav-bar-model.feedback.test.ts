import { describe, expect, it } from "vitest";

import { buildNavBarModel } from "./nav-bar-model";

describe("feedback navigation", () => {
  it.each(["lead", "head", "admin", "viewer"] as const)(
    "shows Feedback for configured role %s",
    (role) => {
      const model = buildNavBarModel({
        user: {
          id: `${role}-user`,
          name: `${role} user`,
          email: `${role}@example.test`,
          role,
        },
        organization: null,
        sessionLoading: false,
        hydrated: true,
        productFeedbackInboxEnabled: true,
      });
      expect(model.visibleLinks).toContainEqual(
        expect.objectContaining({ href: "/feedback", label: "Feedback" }),
      );
    },
  );

  it("hides Feedback when the fail-closed switch is off", () => {
    const model = buildNavBarModel({
      user: {
        id: "lead-user",
        name: "Lead User",
        email: "lead@example.test",
        role: "lead",
      },
      organization: null,
      sessionLoading: false,
      hydrated: true,
      productFeedbackInboxEnabled: false,
    });
    expect(model.visibleLinks.some((link) => link.href === "/feedback")).toBe(
      false,
    );
  });
});
