-- Migration 0006 added release_year to six catalog tables but skipped fans,
-- while fanInsert still writes the column; seeding then fails with
-- "table fans has no column named release_year". Complete the column set.
ALTER TABLE fans ADD COLUMN release_year integer;

PRAGMA optimize;
