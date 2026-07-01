create table if not exists import_runs (
  id text primary key,
  source text not null,
  started_at text not null,
  completed_at text,
  part_count integer not null default 0,
  warning_count integer not null default 0
);

create table if not exists sff_parts (
  id text primary key,
  import_run_id text not null references import_runs(id) on delete cascade,
  kind text not null,
  source_sheet text not null,
  source_row_number integer not null,
  brand text not null default '',
  name text not null default '',
  display_name text not null,
  status text not null default '',
  seller_url text not null default '',
  product_url text not null default '',

  length_mm real,
  width_mm real,
  height_mm real,
  thickness_mm real,
  volume_l real,
  weight_g real,

  case_seller text not null default '',
  case_style text not null default '',
  case_gpu_riser text not null default '',
  case_psu text not null default '',
  case_cpu_cooler_height_mm real,
  case_gpu_length_mm real,
  case_gpu_width_mm real,
  case_gpu_thickness_mm real,
  case_pcie_slots real,
  case_lp_pcie_slots real,

  gpu_chipset text not null default '',
  gpu_model text not null default '',
  gpu_brand text not null default '',
  gpu_name text not null default '',
  gpu_low_profile integer not null default 0,
  gpu_watercooled integer not null default 0,
  gpu_pcie_pins text not null default '',
  gpu_tdp_w real,
  gpu_pcie_slots real,

  cooler_height_mm real,
  fan_size_mm real,
  psu_form_factor text not null default '',
  psu_wattage real,
  motherboard_form_factor text not null default '',
  ram_height_mm real,

  specs_json text not null default '{}',
  dimensions_json text not null default '{}',
  flags_json text not null default '[]',
  raw_json text not null default '{}',
  links_json text not null default '{}'
);
