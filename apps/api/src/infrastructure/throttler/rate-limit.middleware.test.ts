import { request } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import { describe, expect, it } from "vitest";

import type { AppLogger } from "../../lib/logger";
import { rateLimitHitsTotal } from "../metrics/metrics.registry";
import { createRateLimits } from "./rate-limit.middleware";

// The limiter only logs on a 429; isTest raises every bucket to 1000/min, so
// these single-shot requests never reach the handler and a no-op warn is enough.
const silentLogger = { warn: () => undefined } as unknown as AppLogger;

// Boot a minimal Express app configured exactly like main.ts (`trust proxy: 1`),
// mount the real authLimiter, and echo req.ip — the value the limiter's
// keyGenerator keys on. Returns how Express resolved req.ip for the given headers.
async function resolveReqIp(headers: Record<string, string>): Promise<string> {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  const { authLimiter } = createRateLimits({
    logger: silentLogger,
    isTest: true,
  });
  app.use(authLimiter);
  app.get("/", (req, res) => {
    res.json({ ip: req.ip });
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once("listening", () => {
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;

  try {
    return await new Promise<string>((resolve, reject) => {
      const clientReq = request(
        { host: "127.0.0.1", port, path: "/", headers },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });
          res.on("end", () => {
            const parsed = JSON.parse(Buffer.concat(chunks).toString()) as {
              ip: string;
            };
            resolve(parsed.ip);
          });
        },
      );
      clientReq.on("error", reject);
      clientReq.end();
    });
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
}

describe("rate-limit middleware — trust-proxy IP resolution", () => {
  it("resolves req.ip from X-Forwarded-For when trust proxy is set", async () => {
    expect(await resolveReqIp({ "X-Forwarded-For": "203.0.113.42" })).toBe(
      "203.0.113.42",
    );
  });

  it("falls back to the loopback socket address when no X-Forwarded-For is present", async () => {
    // Loopback may surface as IPv4 (127.0.0.1) or IPv4-mapped IPv6
    // (::ffff:127.0.0.1) depending on the dual-stack bind; either proves req.ip
    // fell back to the real socket peer rather than a fabricated value.
    expect(await resolveReqIp({})).toContain("127.0.0.1");
  });
});

// Read the rateLimitHitsTotal counter for one bucket; absent → 0.
async function vitalsBucketHits(): Promise<number> {
  const metric = await rateLimitHitsTotal.get();
  const entry = metric.values.find((v) => v.labels.bucket === "vitals");
  return entry?.value ?? 0;
}

function postStatus(port: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const clientReq = request(
      { host: "127.0.0.1", port, path: "/api/web-vitals", method: "POST" },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolve(res.statusCode ?? 0);
        });
      },
    );
    clientReq.on("error", reject);
    clientReq.end();
  });
}

describe("rate-limit middleware — vitals limiter budget", () => {
  it("returns 429 over budget and increments the vitals bucket", async () => {
    // Production budget (isTest=false) is 60/min; fire one past it from a single
    // loopback client so the whole burst shares one keyGenerator bucket.
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", 1);
    const { vitalsLimiter } = createRateLimits({
      logger: silentLogger,
      isTest: false,
    });
    app.use("/api/web-vitals", vitalsLimiter);
    app.post("/api/web-vitals", (_req, res) => {
      res.sendStatus(204);
    });

    const server = app.listen(0);
    await new Promise<void>((resolve) => {
      server.once("listening", () => {
        resolve();
      });
    });
    const { port } = server.address() as AddressInfo;

    const before = await vitalsBucketHits();
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 61; i += 1) {
        statuses.push(await postStatus(port));
      }
      expect(statuses.slice(0, 60).every((s) => s === 204)).toBe(true);
      expect(statuses[60]).toBe(429);
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }

    expect(await vitalsBucketHits()).toBeGreaterThan(before);
  });
});
