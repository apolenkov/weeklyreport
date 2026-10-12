import { describe, expect, it } from "vitest";

import { adminUserSchema } from "../schemas/admin/report-admin.schema.js";
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
  it.each([
    ["Алексей", null, "А."],
    ["Алексей", "Иванович", "А.И."],
    ["", "Иванович", "И."],
    ["", null, ""],
  ] as const)(
    "omits the separator for an admitted blank surname with %j and %j",
    (firstName, middleName, expected) => {
      const user = adminUserSchema.parse({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        email: "viewer@example.test",
        name: "Synthetic display name",
        lastName: " ".repeat(3),
        firstName: firstName || " ".repeat(3),
        middleName,
        position: null,
        role: "viewer",
        isActive: true,
      });
      expect(shortName(user)).toBe(expected);
    },
  );

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
  it("surname + initials of the first two given tokens", () => {
    expect(shortNameFromName("Иванов Василий Петрович")).toBe("Иванов В.П.");
  });

  it.each([
    ["Петров Алексей Иван Дмитрий", "Петров А.И."],
    ["Петров Алексей Иван Дмитрий Павел", "Петров А.И."],
    ["Алиев Рашид Гейдар оглы", "Алиев Р.Г."],
    // Known limit: a plain string cannot tell compound parts apart; parts give "Иванова А.П.".
    ["Иванова Анна Мария Петровна", "Иванова А.М."],
  ])("keeps at most two initials for %j", (name, expected) => {
    expect(shortNameFromName(name)).toBe(expected);
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

  it("keeps an astral first code point whole in initials", () => {
    expect(shortNameFromName("山田 𠮷子")).toBe("山田 𠮷.");
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

  it("keeps astral first code points whole from structured parts", () => {
    expect(initials({ lastName: "𠮷田", firstName: "花子" })).toBe("𠮷花");
  });
});

describe("initialsFromName", () => {
  it("uses first + second token under surname-first order", () => {
    expect(initialsFromName("Берёзов Александр Владимирович")).toBe("БА");
  });

  it("single token yields its first two letters", () => {
    expect(initialsFromName("Берёзов")).toBe("БА");
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
