import { afterEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "./app.module";

// The dev-auth fence runs from `AppModule.onApplicationBootstrap` so every
// `NestFactory.create(AppModule)` consumer sees the same fail-closed behaviour.
// These tests instantiate AppModule directly, bypassing the NestJS DI container.
describe("AppModule.onApplicationBootstrap", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  it("throws when NODE_ENV=production AND AUTH_DEV_MODE=true", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_DEV_MODE = "true";
    delete process.env.AUTH_DEV_MODE_ALLOW_TEST;

    const module = new AppModule();
    expect(() => module.onApplicationBootstrap()).toThrow(
      /AUTH_DEV_MODE refused outside test\/dev/,
    );
  });

  it("throws when NODE_ENV=production AND AUTH_DEV_MODE_ALLOW_TEST=true", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_DEV_MODE;
    process.env.AUTH_DEV_MODE_ALLOW_TEST = "true";

    const module = new AppModule();
    expect(() => module.onApplicationBootstrap()).toThrow(
      /AUTH_DEV_MODE refused outside test\/dev/,
    );
  });

  it("does NOT throw when NODE_ENV=development AND AUTH_DEV_MODE=true", () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_DEV_MODE = "true";

    const module = new AppModule();
    expect(() => module.onApplicationBootstrap()).not.toThrow();
  });

  it("does NOT throw when NODE_ENV=production AND neither dev flag is set", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_DEV_MODE;
    delete process.env.AUTH_DEV_MODE_ALLOW_TEST;

    const module = new AppModule();
    expect(() => module.onApplicationBootstrap()).not.toThrow();
  });
});
