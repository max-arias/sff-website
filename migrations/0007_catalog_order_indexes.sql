-- Keep paginated catalog views from scanning and sorting complete tables.
CREATE INDEX IF NOT EXISTS idx_cases_name ON cases(name);
CREATE INDEX IF NOT EXISTS idx_gpus_name ON gpus(name);
CREATE INDEX IF NOT EXISTS idx_cpu_coolers_name ON cpu_coolers(name);
CREATE INDEX IF NOT EXISTS idx_motherboards_name ON motherboards(name);
CREATE INDEX IF NOT EXISTS idx_psus_name ON psus(name);
CREATE INDEX IF NOT EXISTS idx_fans_model ON fans(model);
CREATE INDEX IF NOT EXISTS idx_ram_model ON ram(model);

PRAGMA optimize;
