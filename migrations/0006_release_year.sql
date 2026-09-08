-- Release year is a persisted semantic sort key, not a worker-side fallback.
alter table cases add column release_year integer;
alter table gpus add column release_year integer;
alter table cpu_coolers add column release_year integer;
alter table motherboards add column release_year integer;
alter table psus add column release_year integer;
alter table ram add column release_year integer;
