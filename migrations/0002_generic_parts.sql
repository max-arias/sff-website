create table if not exists sff_parts (
  id text primary key,
  import_run_id text not null references import_runs(id) on delete cascade,
  kind text not null,
  source_sheet text not null,
  row_number integer not null,
  brand text not null default '',
  name text not null default '',
  display_name text not null,
  status text not null default '',
  flags_json text not null default '[]',
  raw_json text not null
);

create table if not exists sff_part_specs (
  id text primary key,
  part_id text not null references sff_parts(id) on delete cascade,
  spec_key text not null,
  spec_value text not null
);

create table if not exists sff_part_dimensions (
  id text primary key,
  part_id text not null references sff_parts(id) on delete cascade,
  dimension_key text not null,
  value real not null
);

create table if not exists sff_part_source_rows (
  id text primary key,
  import_run_id text not null references import_runs(id) on delete cascade,
  part_kind text not null,
  source_sheet text not null,
  row_number integer not null,
  row_json text not null
);

create index if not exists idx_sff_parts_kind on sff_parts(kind);
create index if not exists idx_sff_parts_display_name on sff_parts(display_name);
create index if not exists idx_sff_parts_source on sff_parts(source_sheet);
create index if not exists idx_sff_part_specs_key on sff_part_specs(spec_key);
create index if not exists idx_sff_part_dimensions_key on sff_part_dimensions(dimension_key);
