import "reflect-metadata";

import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { AutoArchiverScheduler } from "./auto-archiver.scheduler.js";
import { PeriodCreatorScheduler } from "./period-creator.scheduler.js";

const reflector = new Reflector();

function getRunDaily(target: object): Function {
  const method: unknown = Object.getOwnPropertyDescriptor(
    target,
    "runDaily",
  )?.value;
  if (typeof method !== "function") {
    throw new TypeError("Expected runDaily method");
  }
  return method;
}

function readCronMetadata(target: object): unknown {
  return reflector.get("SCHEDULE_CRON_OPTIONS", getRunDaily(target));
}

describe("period scheduler timezone wiring", () => {
  it("pins the creator and archiver to their UTC daily boundaries", () => {
    expect(readCronMetadata(PeriodCreatorScheduler.prototype)).toMatchObject({
      cronTime: "5 0 * * *",
      timeZone: "UTC",
    });
    expect(readCronMetadata(AutoArchiverScheduler.prototype)).toMatchObject({
      cronTime: "15 0 * * *",
      timeZone: "UTC",
    });
  });
});
