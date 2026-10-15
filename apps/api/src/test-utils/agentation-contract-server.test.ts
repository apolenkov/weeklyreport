import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

import { connectWithStderrTail } from "./agentation-contract-server";

describe("connectWithStderrTail", () => {
  it("attaches the server's stderr to a failed connect", async () => {
    // Real child process that reports why it cannot start, then exits.
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        "-e",
        "process.stderr.write('missing AGENTATION_API_KEY'); process.exit(1)",
      ],
      stderr: "pipe",
    });
    const client = new Client({ name: "stderr-tail", version: "1.0.0" });

    await expect(
      connectWithStderrTail(client, transport, 4000),
    ).rejects.toThrow(/missing AGENTATION_API_KEY/);
    await client.close();
  });
});
