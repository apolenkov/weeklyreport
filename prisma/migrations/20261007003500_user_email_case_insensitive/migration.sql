BEGIN;

-- Live User.email identity is case-insensitive, matching the snapshot
-- comparator (trim + case-fold). Refuse to build the index while ambiguous
-- case-only duplicates exist: resolving them is an operator decision, never
-- an automatic merge of users, memberships, or review history.
DO $$
DECLARE
  offenders text;
BEGIN
  SELECT string_agg("ids", ', ') INTO offenders
  FROM (
    SELECT array_to_string(array_agg("id"), ', ') AS "ids"
    FROM "User"
    GROUP BY lower("email")
    HAVING count(*) > 1
    LIMIT 10
  ) AS duplicates;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'Case-insensitive User.email duplicates block this migration; resolve user ids: %', offenders;
  END IF;
END $$;

-- The exact-case unique on "email" stays for Prisma lookup compatibility;
-- this functional index enforces the shared case-insensitive identity.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"));

COMMIT;
