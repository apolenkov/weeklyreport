import { describe, expect, it } from "vitest";

import { createSentryPrivacyOptions } from "./sentry-policy.js";

const deniedMetadataKeys = ["forwarded", "-ip", "remote-", "via", "-user"];

describe("createSentryPrivacyOptions", () => {
  it("does not configure hooks deprecated ahead of Sentry v12", () => {
    const options = createSentryPrivacyOptions();

    expect(options).not.toHaveProperty("beforeSendTransaction");
    expect(options).not.toHaveProperty("ignoreTransactions");
  });

  it("adds catch-all span filters that drop every transaction root", () => {
    const { ignoreSpans } = createSentryPrivacyOptions();

    expect(ignoreSpans).toContainEqual(/.*/u);
    expect(ignoreSpans).toContainEqual({ op: /.*/u });
  });

  it("keeps the static lifecycle the errors-only drop relies on", () => {
    expect(createSentryPrivacyOptions().traceLifecycle).toBe("static");
  });

  it("keeps the restricted automatic data collection", () => {
    const { dataCollection } = createSentryPrivacyOptions();

    expect(dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    });
    expect(dataCollection.httpHeaders).toEqual({
      request: { deny: deniedMetadataKeys },
      response: { deny: deniedMetadataKeys },
    });
    expect(dataCollection.urlQueryParams).toEqual({ deny: deniedMetadataKeys });
  });
});
