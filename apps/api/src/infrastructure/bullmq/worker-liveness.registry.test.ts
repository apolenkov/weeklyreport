import { describe, expect, it } from "vitest";

import { WorkerLivenessRegistry } from "./worker-liveness.registry.js";

function runtimeWorker() {
  let running = true;
  let paused = false;
  return {
    handle: {
      isRunning: () => running,
      isPaused: () => paused,
    },
    stop: () => {
      running = false;
    },
    pause: () => {
      paused = true;
    },
  };
}

describe("WorkerLivenessRegistry", () => {
  it("fails closed until every required worker reports ready", () => {
    const registry = new WorkerLivenessRegistry();
    const pdf = runtimeWorker();
    const email = runtimeWorker();
    const aiProvider = runtimeWorker();
    const semantic = runtimeWorker();
    const pdfRegistration = registry.register("pdf-export", pdf.handle);
    registry.register("email-reminder", email.handle);
    const aiProviderRegistration = registry.register(
      "ai-provider-test",
      aiProvider.handle,
    );
    const semanticRegistration = registry.register(
      "semantic-index",
      semantic.handle,
    );

    pdfRegistration.markReady();
    aiProviderRegistration.markReady();
    semanticRegistration.markReady();

    expect(registry.requiredWorkers()).toEqual({
      ready: false,
      workers: {
        "email-reminder": "starting",
        "pdf-export": "ready",
        "ai-provider-test": "ready",
        "semantic-index": "ready",
      },
    });
  });

  it("reads stopped and paused state from the current worker handles", () => {
    const registry = new WorkerLivenessRegistry();
    const pdf = runtimeWorker();
    const email = runtimeWorker();
    const aiProvider = runtimeWorker();
    const semantic = runtimeWorker();
    const pdfRegistration = registry.register("pdf-export", pdf.handle);
    const emailRegistration = registry.register("email-reminder", email.handle);
    const aiProviderRegistration = registry.register(
      "ai-provider-test",
      aiProvider.handle,
    );
    const semanticRegistration = registry.register(
      "semantic-index",
      semantic.handle,
    );
    pdfRegistration.markReady();
    emailRegistration.markReady();
    aiProviderRegistration.markReady();
    semanticRegistration.markReady();
    expect(registry.requiredWorkers().ready).toBe(true);

    pdf.stop();
    email.pause();

    expect(registry.requiredWorkers()).toEqual({
      ready: false,
      workers: {
        "email-reminder": "paused",
        "pdf-export": "stopped",
        "ai-provider-test": "ready",
        "semantic-index": "ready",
      },
    });
  });

  it("recovers only from the latest worker registration", () => {
    const registry = new WorkerLivenessRegistry();
    const firstPdf = runtimeWorker();
    const currentPdf = runtimeWorker();
    const email = runtimeWorker();
    const aiProvider = runtimeWorker();
    const semantic = runtimeWorker();
    const stale = registry.register("pdf-export", firstPdf.handle);
    const current = registry.register("pdf-export", currentPdf.handle);
    const emailRegistration = registry.register("email-reminder", email.handle);
    const aiProviderRegistration = registry.register(
      "ai-provider-test",
      aiProvider.handle,
    );
    const semanticRegistration = registry.register(
      "semantic-index",
      semantic.handle,
    );

    stale.markReady();
    current.markReady();
    emailRegistration.markReady();
    aiProviderRegistration.markReady();
    semanticRegistration.markReady();
    stale.markStopped();

    expect(registry.requiredWorkers()).toEqual({
      ready: true,
      workers: {
        "email-reminder": "ready",
        "pdf-export": "ready",
        "ai-provider-test": "ready",
        "semantic-index": "ready",
      },
    });

    current.markStopped();
    current.markReady();
    expect(registry.requiredWorkers().workers["pdf-export"]).toBe("stopped");
  });
});
