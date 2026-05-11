-- UFB-068: drop the dead `periodCadence` column from AppSettings.
--
-- This column stored "weekly" | "bi-weekly" but the PeriodCreator and all
-- other scheduler consumers never read it — they read `periodLengthDays`
-- exclusively. The UI radio (settings-tab.tsx) was the only writer. Since
-- period length is already expressed by `periodLengthDays`, this column is
-- redundant and is removed to eliminate the confusion.
--
-- The singleton AppSettings row carries the "weekly" default; no business
-- data is lost by dropping it.

ALTER TABLE "AppSettings" DROP COLUMN "periodCadence";
