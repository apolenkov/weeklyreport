import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type {
  AgentationAnnotationCreate,
  AgentationAnnotationResponse,
} from "@customreport/shared";
import {
  Agentation,
  type Annotation,
  loadAnnotations,
  saveAnnotations,
} from "agentation";
import { describe, expect, expectTypeOf, it } from "vitest";

import webPackage from "../../../package.json";

// JSON omits undefined optional values; compare the types of fields actually sent.
type JsonFields<T> = T extends readonly (infer Item)[]
  ? JsonFields<Item>[]
  : T extends object
    ? { [Key in keyof T]-?: JsonFields<Exclude<T[Key], undefined>> }
    : T;

describe("Agentation web contract", () => {
  it("exposes the official APIs used by WeeklyReport", () => {
    expect(Agentation).toBeTypeOf("function");
    expect(loadAnnotations).toBeTypeOf("function");
    expect(saveAnnotations).toBeTypeOf("function");
  });

  it("uses the exact manifest version and reviewed license", () => {
    const require = createRequire(import.meta.url);
    const entrypoint = require.resolve("agentation");
    const packageJson = JSON.parse(
      readFileSync(join(dirname(entrypoint), "../package.json"), "utf8"),
    ) as { license: string; name: string; version: string };

    expect(packageJson).toMatchObject({
      license: "PolyForm-Shield-1.0.0",
      name: "agentation",
      version: webPackage.devDependencies.agentation,
    });
    expect(webPackage.devDependencies.agentation).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  it("matches the public annotation field types and accounts for server-owned fields", () => {
    expectTypeOf<Annotation["clientId"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<JsonFields<AgentationAnnotationCreate>>().toEqualTypeOf<
      JsonFields<Pick<Annotation, keyof AgentationAnnotationCreate>>
    >();
    type CommonFields = keyof AgentationAnnotationResponse & keyof Annotation;
    expectTypeOf<
      JsonFields<Pick<AgentationAnnotationResponse, CommonFields>>
    >().toEqualTypeOf<JsonFields<Pick<Annotation, CommonFields>>>();
    expectTypeOf<
      Exclude<keyof Annotation, keyof AgentationAnnotationCreate>
    >().toEqualTypeOf<
      | "clientId"
      | "sessionId"
      | "url"
      | "status"
      | "thread"
      | "createdAt"
      | "updatedAt"
      | "resolvedAt"
      | "resolvedBy"
      | "authorId"
      | "_syncedTo"
    >();
  });
});
