-- Compact search keys avoid worker-side full-catalog scans and match spacing /
-- punctuation variants (for example, "Thor Zone" and "thorzone").
alter table cases add column normalized_search_text text not null default '';
alter table gpus add column normalized_search_text text not null default '';
alter table cpu_coolers add column normalized_search_text text not null default '';
alter table motherboards add column normalized_search_text text not null default '';
alter table psus add column normalized_search_text text not null default '';
alter table ram add column normalized_search_text text not null default '';

-- Measured indexes: availability/title/ID is the common stable default order;
-- normalized text is the bounded search predicate. Metric indexes are omitted
-- deliberately because filters are sparse and vary by active kind.
create index if not exists idx_cases_available_title_id on cases(availability_status, name, id);
create index if not exists idx_gpus_available_title_id on gpus(availability_status, name, id);
create index if not exists idx_cpu_coolers_available_title_id on cpu_coolers(availability_status, name, id);
create index if not exists idx_motherboards_available_title_id on motherboards(availability_status, name, id);
create index if not exists idx_psus_available_title_id on psus(availability_status, name, id);
create index if not exists idx_ram_available_title_id on ram(availability_status, model, id);
create index if not exists idx_cases_normalized_search_text on cases(normalized_search_text);
create index if not exists idx_gpus_normalized_search_text on gpus(normalized_search_text);
create index if not exists idx_cpu_coolers_normalized_search_text on cpu_coolers(normalized_search_text);
create index if not exists idx_motherboards_normalized_search_text on motherboards(normalized_search_text);
create index if not exists idx_psus_normalized_search_text on psus(normalized_search_text);
create index if not exists idx_ram_normalized_search_text on ram(normalized_search_text);
