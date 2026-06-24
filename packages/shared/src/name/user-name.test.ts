import { describe, expect, it } from "vitest";

import {
  composeName,
  initials,
  initialsFromName,
  shortName,
} from "./user-name";

describe("composeName", () => {
  it("composes full ФИО surname-first", () => {
    expect(
      composeName({
        lastName: "Петров",
        firstName: "Алексей",
        middleName: "Иванович",
      }),
    ).toBe("Петров Алексей Иванович");
  });

  it("omits an absent patronymic", () => {
    expect(
      composeName({
        lastName: "Петров",
        firstName: "Алексей",
        middleName: null,
      }),
    ).toBe("Петров Алексей");
  });

  it("trims and single-spaces noisy parts", () => {
    expect(
      composeName({
        lastName: "  Петров ",
        firstName: " Алексей  ",
        middleName: "  ",
      }),
    ).toBe("Петров Алексей");
  });
});

describe("shortName", () => {
  it("surname + given/patronymic initials with patronymic", () => {
    expect(
      shortName({
        lastName: "Берёзов",
        firstName: "Александр",
        middleName: "Владимирович",
      }),
    ).toBe("Берёзов А.В.");
  });

  it("surname + given initial without patronymic", () => {
    expect(
      shortName({
        lastName: "Берёзов",
        firstName: "Александр",
        middleName: null,
      }),
    ).toBe("Берёзов А.");
  });
});

describe("initials", () => {
  it("prefers structured parts: surname + given (not patronymic)", () => {
    expect(
      initials({
        lastName: "Берёзов",
        firstName: "Александр",
        name: "Берёзов Александр Владимирович",
      }),
    ).toBe("БА");
  });

  it("falls back to the name string when parts are absent", () => {
    expect(initials({ name: "Берёзов Александр Владимирович" })).toBe("БА");
  });

  it("returns empty when nothing is available", () => {
    expect(initials({})).toBe("");
  });
});

describe("initialsFromName", () => {
  it("uses first + second token under surname-first order", () => {
    expect(initialsFromName("Берёзов Александр Владимирович")).toBe("БА");
  });

  it("single token yields its first two letters", () => {
    expect(initialsFromName("Берёзов")).toBe("БА");
  });

  it("empty string yields empty", () => {
    expect(initialsFromName(" ".repeat(3))).toBe("");
  });
});
