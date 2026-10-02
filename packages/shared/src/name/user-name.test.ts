import { describe, expect, it } from "vitest";

import {
  composeName,
  initials,
  initialsFromName,
  shortName,
  shortNameFromName,
} from "./user-name.js";

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
        lastName: "Баленков",
        firstName: "Александр",
        middleName: "Владимирович",
      }),
    ).toBe("Баленков А.В.");
  });

  it("surname + given initial without patronymic", () => {
    expect(
      shortName({
        lastName: "Баленков",
        firstName: "Александр",
        middleName: null,
      }),
    ).toBe("Баленков А.");
  });

  it("keeps an astral first code point whole in the initial", () => {
    expect(
      shortName({
        lastName: "田中",
        firstName: "𠮷子",
        middleName: null,
      }),
    ).toBe("田中 𠮷.");
  });
});

describe("shortNameFromName", () => {
  it("surname + dotted initials of the remaining tokens", () => {
    expect(shortNameFromName("Иванов Василий Петрович")).toBe("Иванов В.П.");
  });

  it("surname + given initial when there is no patronymic", () => {
    expect(shortNameFromName("Кузнецова Мария")).toBe("Кузнецова М.");
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

  it("keeps an astral first code point whole in initials", () => {
    expect(shortNameFromName("山田 𠮷子")).toBe("山田 𠮷.");
  });
});

describe("initials", () => {
  it("prefers structured parts: surname + given (not patronymic)", () => {
    expect(
      initials({
        lastName: "Баленков",
        firstName: "Александр",
        name: "Баленков Александр Владимирович",
      }),
    ).toBe("БА");
  });

  it("falls back to the name string when parts are absent", () => {
    expect(initials({ name: "Баленков Александр Владимирович" })).toBe("БА");
  });

  it("returns empty when nothing is available", () => {
    expect(initials({})).toBe("");
  });

  it("keeps astral first code points whole from structured parts", () => {
    expect(initials({ lastName: "𠮷田", firstName: "花子" })).toBe("𠮷花");
  });
});

describe("initialsFromName", () => {
  it("uses first + second token under surname-first order", () => {
    expect(initialsFromName("Баленков Александр Владимирович")).toBe("БА");
  });

  it("single token yields its first two letters", () => {
    expect(initialsFromName("Баленков")).toBe("БА");
  });

  it("keeps astral first letters whole across tokens", () => {
    expect(initialsFromName("𠮷田 花子")).toBe("𠮷花");
  });

  it("takes two code points for a single astral-led token", () => {
    expect(initialsFromName("𠮷田")).toBe("𠮷田");
  });

  it("does not split an astral pair in the second position", () => {
    expect(initialsFromName("花𠮷")).toBe("花𠮷");
  });

  it("empty string yields empty", () => {
    expect(initialsFromName(" ".repeat(3))).toBe("");
  });
});
