create table if not exists import_runs (
  id text primary key,
  source text not null,
  started_at text not null,
  completed_at text,
  case_count integer not null default 0,
  gpu_count integer not null default 0,
  warning_count integer not null default 0
);

create table if not exists raw_sheet_rows (
  id text primary key,
  import_run_id text not null references import_runs(id) on delete cascade,
  part_kind text not null check (part_kind in ('case', 'gpu')),
  source_sheet text not null,
  row_number integer not null,
  row_json text not null
);

create table if not exists cases (
  id text primary key,
  import_run_id text not null references import_runs(id) on delete cascade,
  source_sheet text not null,
  row_number integer not null,
  seller text not null default '',
  name text not null,
  style text not null default '',
  status text not null default '',
  case_length_mm real,
  case_width_mm real,
  case_height_mm real,
  volume_l real,
  cpu_cooler_height_mm real,
  gpu_length_mm real,
  gpu_width_mm real,
  gpu_thickness_mm real,
  pcie_slots real,
  lp_pcie_slots real,
  gpu_riser text not null default '',
  psu text not null default '',
  flags_json text not null default '[]',
  raw_json text not null
);

create table if not exists gpus (
  id text primary key,
  import_run_id text not null references import_runs(id) on delete cascade,
  source_sheet text not null,
  row_number integer not null,
  chipset text not null default '',
  model text not null default '',
  brand text not null default '',
  name text not null default '',
  length_mm real,
  width_mm real,
  thickness_mm real,
  pcie_slots real,
  low_profile integer not null default 0,
  watercooled integer not null default 0,
  pcie_pins text not null default '',
  tdp_w real,
  flags_json text not null default '[]',
  raw_json text not null
);

create index if not exists idx_cases_name on cases(name);
create index if not exists idx_cases_seller on cases(seller);
create index if not exists idx_cases_style on cases(style);
create index if not exists idx_gpus_model on gpus(model);
create index if not exists idx_gpus_brand on gpus(brand);
create index if not exists idx_gpus_chipset on gpus(chipset);
