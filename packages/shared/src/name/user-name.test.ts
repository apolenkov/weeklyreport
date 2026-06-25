import { describe, expect, it } from "vitest";

import {
  composeName,
  initials,
  initialsFromName,
  shortName,
  shortNameFromName,
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

describe("shortNameFromName", () => {
  it("surname + dotted initials of the remaining tokens", () => {
    expect(shortNameFromName("Иванов Василий Петрович")).toBe("Иванов В.П.");
  });

  it("surname + given initial when there is no patronymic", () => {
    expect(shortNameFromName("Каштанова Мария")).toBe("Каштанова М.");
  });

  it("single token returns just the surname", () => {
    expect(shortNameFromName("Иванов")).toBe("Иванов");
  });

  it("collapses noisy whitespace", () => {
    expect(shortNameFromName(`Иванов${" ".repeat(3)}Василий`)).toBe(
      "Иванов В.",
    );
  });

  it("empty string yields empty", () => {
    expect(shortNameFromName(" ".repeat(3))).toBe("");
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
