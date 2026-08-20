/**
 * Admin CRUD integration tests — verifies that admin UI mutations persist to
 * PostgreSQL via real tRPC procedures (no mocks).
 */

import { test, expect } from "./fixtures";
import { prisma } from "./helpers/db";
import { randomUUID } from "node:crypto";
import {
  ACTIVE_REPORT_ID,
  LEAD_1_ID,
  LEAD_OLGA_ID,
  SEED_PRODUCTS,
} from "./helpers/seed-ids";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("Admin CRUD (integration)", () => {
  test("admin can create a new product and it appears in DB", async ({
    adminPage,
  }) => {
    await adminPage.goto("/admin/products");

    const addBtn = adminPage.getByRole("button", { name: "Add new product" });
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();

    // Scope to the dialog: the products toolbar also has a "Filter products
    // by name" search box whose accessible name matches a loose /name/i
    // locator, so an unscoped getByLabel grabs the wrong field.
    const dialog = adminPage.getByRole("dialog", { name: /add product/i });
    await expect(dialog).toBeVisible();

    const nameField = dialog.getByLabel("Product Name");
    const uniqueName = `IntegrationTest Product ${Date.now()}`;
    await nameField.fill(uniqueName);

    const saveBtn = dialog.getByRole("button", { name: "Add Product" });
    await saveBtn.click();

    await adminPage.waitForResponse(
      (r) => r.url().includes("/trpc/") && r.request().method() === "POST",
      { timeout: 15_000 },
    );

    const product = await prisma.project.findFirst({
      where: { name: uniqueName },
    });
    expect(product).not.toBeNull();

    // Cleanup — this row is outside the seed baseline, so resetMutations()
    // (which only re-upserts seeded rows) won't remove it.
    if (product) {
      await prisma.project.delete({ where: { id: product.id } });
    }
  });

  test("admin Organization identity update persists across page reload", async ({
    adminPage,
  }) => {
    await adminPage.goto("/admin/settings");

    const shortNameField = adminPage.getByRole("textbox", {
      name: /^Short name$/i,
    });
    await expect(shortNameField).toBeVisible({ timeout: 15_000 });
    // Wait for the org query to seed the form: editing while it still loads
    // marks the form dirty, the late-arriving data is then ignored, and the
    // empty Full name keeps Save disabled forever.
    await expect(shortNameField).not.toHaveValue("", { timeout: 15_000 });

    // shortName is max 16 chars; keep the value short enough to fit.
    const newShortName = `Tst${Date.now() % 10000}`;
    await shortNameField.fill(newShortName);

    const saveBtn = adminPage.getByRole("button", {
      name: /save organization identity/i,
    });
    await saveBtn.last().click();

    await adminPage.waitForResponse(
      (r) => r.url().includes("/trpc/") && r.request().method() === "POST",
      { timeout: 15_000 },
    );

    try {
      const org = await prisma.organization.findUnique({
        where: { id: "singleton" },
      });
      expect(org?.shortName).toBe(newShortName);
      const shortNamePattern = new RegExp(escapeRegExp(newShortName));

      await adminPage.goto("/head/dashboard");
      await expect(adminPage.getByText(shortNamePattern).first()).toBeVisible();

      await adminPage.goto(
        `/lead/report/${ACTIVE_REPORT_ID}?authorId=${LEAD_OLGA_ID}`,
      );
      await expect(adminPage.getByText(shortNamePattern).first()).toBeVisible();
    } finally {
      // Restore seed value to avoid cross-test pollution.
      await prisma.organization.update({
        where: { id: "singleton" },
        data: { shortName: "Demo" },
      });
    }
  });

  test("admin product list reflects DB state for a known seed product", async ({
    adminPage,
  }) => {
    await adminPage.goto("/admin/products");

    const lead1ProductCount = await prisma.project.count({
      where: { leadId: LEAD_1_ID },
    });
    const lead1ProductNames = SEED_PRODUCTS.filter(
      (product) => product.leadId === LEAD_1_ID,
    ).map((product) => product.name);
    expect(lead1ProductCount).toBe(lead1ProductNames.length);
    const firstSeededProduct = lead1ProductNames.at(0);
    if (!firstSeededProduct) {
      throw new Error("No seed products found for LEAD_1_ID");
    }

    // Page should mention at least one seeded name. The
    // /admin/products route redirects to /admin?tab=products, which mounts
    // AdminPanel and fires the admin.snapshot tRPC query async. Wait for
    // the seeded product name to appear in the rendered DOM before
    // snapshotting HTML — Playwright will retry the locator until it
    // resolves or hits the default expect timeout.
    await expect(adminPage.getByText(firstSeededProduct).first()).toBeVisible();

    const html = await adminPage.content();
    expect(html).toContain(firstSeededProduct);
  });

  test("admin can save a global AI provider draft without activating it", async ({
    adminPage,
  }) => {
    const suffix = `${Date.now()}`;
    const plannerModel = `e2e-planner-${suffix}`;
    const answerModel = `e2e-answer-${suffix}`;
    const embeddingModel = `e2e-embedding-${suffix}`;

    try {
      await adminPage.goto("/admin/settings");
      await adminPage.getByRole("tab", { name: "AI" }).click();
      await adminPage.getByRole("tab", { name: "Provider" }).click();

      await expect(
        adminPage.getByTestId("integration-row-ai"),
      ).toBeVisible({ timeout: 15_000 });
      await adminPage
        .getByLabel("Generation provider profile")
        .selectOption("custom-openai-compatible");
      await adminPage
        .getByLabel("Generation endpoint")
        .fill("https://ai.example.com/v1");
      await adminPage.getByLabel("Planner model").fill(plannerModel);
      await adminPage.getByLabel("Answer model").fill(answerModel);
      await adminPage
        .getByLabel("Embedding connection mode")
        .selectOption("separate");
      await adminPage
        .getByLabel("Embeddings provider profile")
        .selectOption("custom-openai-compatible");
      await adminPage
        .getByLabel("Embeddings endpoint")
        .fill("https://ai.example.com/v1");
      await adminPage.getByLabel("Embedding model").fill(embeddingModel);
      await adminPage
        .getByLabel("Generation credential")
        .fill("e2e-generation-secret");
      await adminPage
        .getByLabel("Embeddings credential")
        .fill("e2e-embedding-secret");

      const saveResponse = adminPage.waitForResponse(
        (response) =>
          response.url().includes("admin.aiProvider.save") &&
          response.request().method() === "POST",
        { timeout: 15_000 },
      );
      await adminPage.getByRole("button", { name: "Save draft" }).click();
      await saveResponse;

      const stored = await prisma.aiProviderConfiguration.findFirst({
        where: { plannerModel },
      });
      expect(stored).toMatchObject({
        answerModel,
        embeddingModel,
        embeddingDimensions: null,
        embeddingMode: "separate",
        embeddingProfile: "custom_openai_compatible",
        embeddingBaseUrl: "https://ai.example.com/v1",
        lifecycle: "draft",
      });
      expect(stored?.generationCredentialCiphertext).not.toContain(
        "e2e-generation-secret",
      );
      expect(stored?.embeddingCredentialCiphertext).not.toContain(
        "e2e-embedding-secret",
      );
      const control = await prisma.aiProviderControl.findUnique({
        where: { id: "singleton" },
      });
      expect(control).toMatchObject({
        activeConfigurationId: null,
        enabled: false,
      });
    } finally {
      await prisma.aiProviderControl.update({
        where: { id: "singleton" },
        data: { activeConfigurationId: null, enabled: false },
      });
      await prisma.aiProviderConfiguration.deleteMany({
        where: { plannerModel },
      });
    }
  });

  test("admin AI workspace keeps provider, prompt, and Lead availability coherent", async ({
    adminPage,
    leadPage,
  }) => {
    const startedAt = new Date();
    const providerId = randomUUID();
    const featureKey = "lead-report-assistant";
    const baseline = await prisma.aiPromptBundleRevision.findFirst({
      where: { featureKey, lifecycle: "active" },
    });
    if (!baseline) throw new Error("AI prompt baseline is missing");
    const originalControl = await prisma.aiProviderControl.findUnique({
      where: { id: "singleton" },
    });

    await prisma.aiProviderConfiguration.create({
      data: {
        id: providerId,
        generationProfile: "custom_openai_compatible",
        generationBaseUrl: "https://ai.example.com/v1",
        generationEndpointIdentity: `e2e:${providerId}`,
        plannerModel: "e2e-planner",
        answerModel: "e2e-answer",
        embeddingModel: "e2e-embedding",
        embeddingDimensions: 3,
        semanticInputVersion: "report-assistant/v1",
        reasoningMode: "provider_default",
        reasoningCustomValue: null,
        generationCredentialCiphertext: "e2e-ciphertext",
        generationCredentialNonce: "e2e-nonce",
        generationCredentialTag: "e2e-tag",
        generationCredentialKeyVersion: 1,
        generationCredentialMaskedSuffix: "••••test",
        embeddingMode: "reuse_generation",
        embeddingProfile: null,
        embeddingBaseUrl: null,
        embeddingEndpointIdentity: null,
        embeddingCredentialCiphertext: null,
        embeddingCredentialNonce: null,
        embeddingCredentialTag: null,
        embeddingCredentialKeyVersion: null,
        embeddingCredentialMaskedSuffix: null,
        generationCompatibilityIdentity: `generation-${providerId}`,
        embeddingScopeIdentity: `embedding-${providerId}`,
        compositeTestIdentity: `composite-${providerId}`,
        lifecycle: "active",
        testResult: {
          status: "passed",
          generation: {
            status: "passed",
            capabilities: [
              { capability: "authentication", status: "passed" },
            ],
          },
          embeddings: {
            status: "passed",
            capabilities: [
              { capability: "batch_embeddings", status: "passed" },
            ],
          },
          testedAt: startedAt.toISOString(),
        },
        testedAt: startedAt,
        activatedAt: startedAt,
      },
    });
    await prisma.aiProviderControl.upsert({
      where: { id: "singleton" },
      update: { activeConfigurationId: providerId, enabled: true },
      create: { id: "singleton", activeConfigurationId: providerId, enabled: true },
    });
    try {
      await adminPage.goto("/admin/settings");
      await adminPage.getByRole("tab", { name: "AI" }).click();
      await expect(adminPage.getByText("AI overview")).toBeVisible();

      await adminPage.getByRole("tab", { name: "Provider" }).click();
      await adminPage.getByRole("button", { name: "Toggle AI provider settings" }).click();
      await adminPage
        .getByLabel("Generation credential")
        .fill("e2e-generation-secret");
      await adminPage.getByRole("button", { name: "Save draft" }).click();
      await expect(adminPage.getByRole("button", { name: "Discard" })).toBeVisible();
      adminPage.once("dialog", (dialog) => dialog.accept());
      await adminPage.getByRole("button", { name: "Discard" }).click();
      await expect.poll(async () =>
        prisma.aiProviderConfiguration.count({ where: { lifecycle: "draft" } }),
      ).toBe(0);

      await adminPage.getByRole("tab", { name: "Features" }).click();
      await adminPage.getByRole("button", { name: "Report Assistant" }).click();
      const plannerPrompt = adminPage.getByRole("textbox", { name: "planner prompt" });
      await adminPage.getByText("planner", { exact: true }).click();
      await plannerPrompt.fill("E2E complete planner prompt.");
      await adminPage.getByRole("button", { name: "Save Draft" }).click();
      await expect.poll(async () =>
        prisma.aiPromptBundleRevision.findFirst({
          where: { featureKey, lifecycle: "draft", createdAt: { gte: startedAt } },
        }),
      ).not.toBeNull();
      const candidate = await prisma.aiPromptBundleRevision.findFirst({
        where: { featureKey, lifecycle: "draft", createdAt: { gte: startedAt } },
        orderBy: { revision: "desc" },
      });
      if (!candidate) throw new Error("Prompt draft was not persisted");
      await prisma.aiPromptBundleRevision.update({
        where: { id: candidate.id },
        data: { lifecycle: "validated" },
      });
      await adminPage.reload();
      await adminPage.getByRole("tab", { name: "AI" }).click();
      await adminPage.getByRole("tab", { name: "Features" }).click();
      await adminPage.getByRole("button", { name: "Report Assistant" }).click();
      await expect(adminPage.getByRole("button", { name: /Activate/ })).toBeEnabled();
      adminPage.once("dialog", (dialog) => dialog.accept());
      await adminPage.getByRole("button", { name: "Activate" }).click();
      await expect.poll(async () =>
        (await prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }))
          ?.activeRevisionId,
      ).toBe(candidate.id);

      await adminPage.getByRole("button", { name: /Version 1/ }).click();
      await expect(adminPage.getByRole("button", { name: "Restore" })).toBeEnabled();
      adminPage.once("dialog", (dialog) => dialog.accept());
      await adminPage.getByRole("button", { name: "Restore" }).click();
      await expect.poll(async () =>
        (await prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }))
          ?.activeRevisionId,
      ).toBe(baseline.id);
      await leadPage.goto(`/lead/report/${ACTIVE_REPORT_ID}?authorId=${LEAD_OLGA_ID}`);
      await expect(leadPage.getByRole("button", { name: "Chat" })).toBeEnabled();
    } finally {
      await prisma.aiFeaturePromptControl.update({
        where: { featureKey },
        data: { activeRevisionId: baseline.id },
      });
      await prisma.aiPromptBundleRevision.update({
        where: { id: baseline.id },
        data: { lifecycle: "active", supersededAt: null, activatedAt: new Date() },
      });
      const createdPromptRows = await prisma.aiPromptBundleRevision.findMany({
        where: { featureKey, createdAt: { gte: startedAt }, id: { not: baseline.id } },
        select: { id: true },
      });
      const createdPromptIds = createdPromptRows.map(({ id }) => id);
      if (createdPromptIds.length > 0) {
        await prisma.aiPromptBundleRevision.deleteMany({
          where: { id: { in: createdPromptIds } },
        });
      }
      await prisma.aiProviderControl.upsert({
        where: { id: "singleton" },
        update: {
          activeConfigurationId: originalControl?.activeConfigurationId ?? null,
          enabled: originalControl?.enabled ?? false,
        },
        create: {
          id: "singleton",
          activeConfigurationId: originalControl?.activeConfigurationId ?? null,
          enabled: originalControl?.enabled ?? false,
        },
      });
      const createdProviders = await prisma.aiProviderConfiguration.findMany({
        where: { createdAt: { gte: startedAt } },
        select: { id: true },
      });
      const createdProviderIds = createdProviders.map(({ id }) => id);
      if (createdProviderIds.length > 0) {
        await prisma.aiProviderConfiguration.deleteMany({
          where: { id: { in: createdProviderIds } },
        });
      }
    }
  });
});
