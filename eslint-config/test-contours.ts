export const NAMED_TEST_FILES = [
  "**/*.test.{ts,tsx}",
  "**/*.spec.{ts,tsx}",
  "**/__tests__/**",
] as const;

export const TEST_SUPPORT_FILES = [
  "**/test-utils/**",
  "**/__fixtures__/**",
  "**/fixture/**",
  "**/fixtures/**",
  "**/*-harness.{ts,tsx}",
  "**/*.fixture.{ts,tsx}",
  "**/*.fixtures.{ts,tsx}",
  "**/*-fixture.{ts,tsx}",
  "**/*-test-fixture.{ts,tsx}",
  "e2e/lead-form/fixtures.ts",
  "prisma/seeds/advanced/seed-advanced.ux-fixtures.ts",
] as const;

export const TEST_CONTOUR_IGNORES = [
  ...NAMED_TEST_FILES,
  ...TEST_SUPPORT_FILES,
];
