import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, parse } from "node:path";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const migration = readFileSync(
  new URL(
    "./migrations/20260904100000_agentation_storage/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const schema = readFileSync(
  new URL("./schema.prisma", import.meta.url),
  "utf8",
);

function packageRoot(packageName: string): string {
  let directory = dirname(require.resolve(packageName));
  while (directory !== parse(directory).root) {
    const manifestPath = join(directory, "package.json");
    try {
      readFileSync(manifestPath, "utf8");
      return directory;
    } catch {
      directory = dirname(directory);
    }
  }
  throw new Error(`Missing installed manifest for ${packageName}`);
}

function packageManifest(packageName: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(packageRoot(packageName), "package.json"), "utf8"),
  ) as Record<string, unknown>;
}

function modelBlock(modelName: string): string {
  const match = new RegExp(
    String.raw`model ${modelName} \{([\s\S]*?)\n\}`,
    "u",
  ).exec(schema);
  if (!match) throw new Error(`Missing Prisma model ${modelName}`);
  const block = match[1];
  if (!block) throw new Error(`Empty Prisma model ${modelName}`);
  return block;
}

function scalarFields(modelName: string): string[] {
  const scalarTypes =
    "String|Float|BigInt|Json|Boolean|Int|DateTime|Bytes|Decimal";
  return [
    ...modelBlock(modelName).matchAll(
      new RegExp(
        String.raw`^[ \t]+(\w+)[ \t]+(?:${scalarTypes})(?=[? \t]|$)`,
        "gmu",
      ),
    ),
  ].map(([, field]) => {
    if (!field) throw new Error(`Unnamed scalar field in ${modelName}`);
    return field;
  });
}

describe("Agentation dependency contract", () => {
  it("pins the researched package versions and PolyForm licenses", () => {
    expect(packageManifest("agentation")).toMatchObject({
      name: "agentation",
      version: "3.0.2",
      license: "PolyForm-Shield-1.0.0",
    });
    expect(packageManifest("agentation-mcp")).toMatchObject({
      name: "agentation-mcp",
      version: "1.2.0",
      license: "PolyForm-Shield-1.0.0",
    });
  });

  it("keeps exact versions and integrity records in the lockfile", () => {
    const lockfile = readFileSync(
      new URL("../pnpm-lock.yaml", import.meta.url),
      "utf8",
    );
    expect(lockfile).toContain(
      "agentation-mcp:\n        specifier: 1.2.0\n        version: 1.2.0",
    );
    expect(lockfile).toContain("agentation@3.0.2:");
    expect(lockfile).toContain("agentation-mcp@1.2.0:");
    expect(lockfile).toContain(
      "agentation-mcp@1.2.0:\n    resolution: {integrity: sha512-BRHVm/YRyAHzJFM8i+ZbgpLgpnVptyKeUyauYd2pkOBX/oVFYGOjjLU+YtpNZD1Np+5/jJAp9xFbv1SE112Wwg==}",
    );
    expect(lockfile).toContain(
      "agentation@3.0.2:\n    resolution: {integrity: sha512-iGzBxFVTuZEIKzLY6AExSLAQH6i6SwxV4pAu7v7m3X6bInZ7qlZXAwrEqyc4+EfP4gM7z2RXBF6SF4DeH0f2lA==}",
    );
  });

  it("keeps the installed MCP CLI executable without network access", () => {
    const cli = join(packageRoot("agentation-mcp"), "dist/cli.js");
    const output = execFileSync(process.execPath, [cli, "help"], {
      encoding: "utf8",
      env: { ...process.env, AGENTATION_API_KEY: "" },
      timeout: 10_000,
    });
    expect(output).toContain("server");
    expect(output).toContain("--mcp-only");
    expect(output).toContain("--http-url");
  });

  it("keeps every reviewed MCP tool and adapter path in the installed bundle", () => {
    const bundle = readFileSync(require.resolve("agentation-mcp"), "utf8");
    const normalizedBundle = bundle.replaceAll(
      ["$", "{"].join(""),
      "{template:",
    );
    const toolNames = [
      "agentation_list_sessions",
      "agentation_get_session",
      "agentation_get_pending",
      "agentation_get_all_pending",
      "agentation_acknowledge",
      "agentation_resolve",
      "agentation_dismiss",
      "agentation_reply",
      "agentation_watch_annotations",
    ];
    const transportFragments = [
      "/sessions/{template:sessionId}/pending",
      "/annotations/{template:annotationId}/thread",
      "/sessions/{template:sessionId}/events?agent=true",
      "/events?agent=true",
      "x-api-key",
    ];

    for (const fragment of [...toolNames, ...transportFragments])
      expect(normalizedBundle).toContain(fragment);
  });
});

describe("Agentation storage migration contract", () => {
  it("is additive and touches only the new Agentation objects", () => {
    const statements = migration
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    const allowed =
      /^(?:CREATE TABLE "Agentation(?:Session|Annotation|Event|ThreadMessage)"|CREATE SEQUENCE "AgentationEvent_sequence_seq"|CREATE (?:UNIQUE )?INDEX "Agentation|ALTER SEQUENCE "AgentationEvent_sequence_seq"|ALTER TABLE "Agentation(?:Session|Annotation|Event|ThreadMessage)" ADD CONSTRAINT "Agentation)/u;

    expect(
      statements.some((statement) =>
        /^(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/iu.test(statement),
      ),
    ).toBe(false);
    expect(statements.every((statement) => allowed.test(statement))).toBe(true);
    expect(migration).not.toMatch(/(?:ALTER|CREATE) TABLE "(?!Agentation)/u);
    expect(migration).not.toMatch(/(?:ALTER|CREATE) INDEX "(?!Agentation)/u);
  });

  it("has unique columns and the exact schema fields for each new table", () => {
    const tableColumns = (tableName: string): string[] => {
      const match = new RegExp(
        String.raw`CREATE TABLE "${tableName}" \(([\s\S]*?)\n\);`,
        "u",
      ).exec(migration);
      if (!match) throw new Error(`Missing migration table ${tableName}`);
      const body = match[1];
      if (!body) throw new Error(`Empty migration table ${tableName}`);
      return [...body.matchAll(/^[ \t]+"([^"]+)"[ \t]+/gmu)].map(
        ([, column]) => {
          if (!column)
            throw new Error(`Unnamed migration column in ${tableName}`);
          return column;
        },
      );
    };
    const expected: Record<string, string[]> = {
      AgentationSession: [
        "id",
        "url",
        "status",
        "projectId",
        "metadata",
        "authorUserId",
        "authorReportingGroupId",
        "authorRole",
        "authorName",
        "authorEmail",
        "createdAt",
        "updatedAt",
      ],
      AgentationAnnotation: [
        "id",
        "clientId",
        "sessionId",
        "x",
        "y",
        "comment",
        "element",
        "elementPath",
        "timestamp",
        "selectedText",
        "boundingBox",
        "nearbyText",
        "cssClasses",
        "nearbyElements",
        "computedStyles",
        "fullPath",
        "accessibility",
        "isMultiSelect",
        "isFixed",
        "reactComponents",
        "sourceFile",
        "drawingIndex",
        "elementBoundingBoxes",
        "placement",
        "rearrange",
        "url",
        "kind",
        "intent",
        "severity",
        "status",
        "resolvedAt",
        "resolvedBy",
        "authorUserId",
        "authorReportingGroupId",
        "authorRole",
        "authorName",
        "authorEmail",
        "createdAt",
        "updatedAt",
      ],
      AgentationEvent: [
        "id",
        "sequence",
        "type",
        "sessionId",
        "annotationId",
        "payload",
        "createdAt",
        "authorUserId",
      ],
      AgentationThreadMessage: [
        "id",
        "annotationId",
        "role",
        "content",
        "timestamp",
        "authorUserId",
        "createdAt",
      ],
    };

    for (const [tableName, columns] of Object.entries(expected)) {
      expect(tableColumns(tableName)).toEqual(columns);
      expect(new Set(columns).size).toBe(columns.length);
      expect(new Set(scalarFields(tableName))).toEqual(new Set(columns));
    }

    expect(modelBlock("AgentationSession")).toContain(
      "authorReportingGroupId String?",
    );
    expect(modelBlock("AgentationSession")).toContain(
      'projectId              String                 @default("weekly-report")',
    );
    expect(modelBlock("AgentationSession")).toMatch(
      /author(?:Role|Name|Email)\s+String/u,
    );
    expect(modelBlock("AgentationAnnotation")).toMatch(/clientId\s+String\s/u);
    expect(modelBlock("AgentationAnnotation")).toMatch(
      /author(?:Role|Name|Email)\s+String/u,
    );
    expect(modelBlock("AgentationAnnotation")).not.toMatch(
      /(?:thread|source|context)\s+Json/u,
    );
    expect(modelBlock("AgentationEvent")).toContain("sequence     BigInt");
    expect(modelBlock("AgentationThreadMessage")).toContain(
      "content      String               @db.Text",
    );
  });

  it("declares the required foreign keys, sequence, and indexes", () => {
    expect(migration).toContain(
      'CREATE SEQUENCE "AgentationEvent_sequence_seq"',
    );
    expect(migration).toContain(
      'ALTER SEQUENCE "AgentationEvent_sequence_seq" OWNED BY "AgentationEvent"."sequence"',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("sessionId") REFERENCES "AgentationSession"("id") ON DELETE CASCADE',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "AgentationAnnotation_sessionId_authorUserId_clientId_key"',
    );
    expect(migration).toContain(
      "\"projectId\" TEXT NOT NULL DEFAULT 'weekly-report'",
    );
    expect(migration).toContain('"clientId" TEXT NOT NULL');
    for (const snapshotColumn of ["authorRole", "authorName", "authorEmail"]) {
      expect(
        migration.split(`"${snapshotColumn}" TEXT NOT NULL`).length - 1,
      ).toBe(2);
    }
    expect(migration).toContain(
      'CREATE INDEX "AgentationEvent_sessionId_sequence_idx"',
    );
    expect(migration).toContain(
      'CREATE INDEX "AgentationThreadMessage_annotationId_timestamp_idx"',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("annotationId") REFERENCES "AgentationAnnotation"("id") ON DELETE CASCADE',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL',
    );
  });
});
