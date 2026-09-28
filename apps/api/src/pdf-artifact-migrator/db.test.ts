import { describe, expect, it } from "vitest";

import {
  COMPLETED_GENERATION_ONE_SELECT,
  createRowSource,
  type MigratorQueryable,
  READ_ONLY_SESSION_PIN,
} from "./db.js";

class RecordingQueryable implements MigratorQueryable {
  readonly statements: string[] = [];
  ended = false;
  rows: { jobId: string; checksum: string | null }[] = [];

  query(
    text: string,
  ): Promise<{ rows: { jobId: string; checksum: string | null }[] }> {
    this.statements.push(text);
    return Promise.resolve({ rows: this.rows });
  }

  end(): Promise<void> {
    this.ended = true;
    return Promise.resolve();
  }
}

const WRITE_PATTERN =
  /\b(?:insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|vacuum)\b/iu;

describe("createRowSource", () => {
  it("pins the session read-only before the single SELECT", async () => {
    const client = new RecordingQueryable();
    const source = createRowSource(client);
    await source.listRows();

    expect(client.statements).toEqual([
      READ_ONLY_SESSION_PIN,
      COMPLETED_GENERATION_ONE_SELECT,
    ]);
  });

  it("issues zero write statements", async () => {
    const client = new RecordingQueryable();
    const source = createRowSource(client);
    await source.listRows();
    await source.listRows();

    expect(
      client.statements.filter((text) => WRITE_PATTERN.test(text)),
    ).toEqual([]);
  });

  it("selects only completed generation-1 rows", () => {
    expect(COMPLETED_GENERATION_ONE_SELECT).toContain('"PdfExportJob"');
    expect(COMPLETED_GENERATION_ONE_SELECT).toContain("'completed'");
    expect(COMPLETED_GENERATION_ONE_SELECT).toContain('"generation" = 1');
    expect(COMPLETED_GENERATION_ONE_SELECT.toUpperCase()).toContain("SELECT");
    expect(WRITE_PATTERN.test(COMPLETED_GENERATION_ONE_SELECT)).toBe(false);
    expect(WRITE_PATTERN.test(READ_ONLY_SESSION_PIN)).toBe(false);
  });

  it("maps database rows to {jobId, checksum}", async () => {
    const client = new RecordingQueryable();
    client.rows = [
      { jobId: "a0000000-0000-4000-a000-000000000400", checksum: "abc" },
      { jobId: "a0000000-0000-4000-a000-000000000401", checksum: null },
    ];
    const rows = await createRowSource(client).listRows();
    expect(rows).toEqual(client.rows);
  });

  it("close() ends the client", async () => {
    const client = new RecordingQueryable();
    await createRowSource(client).close();
    expect(client.ended).toBe(true);
  });
});
