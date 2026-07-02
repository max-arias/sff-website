alter table sff_parts add column psu_tier text not null default '';
alter table sff_parts add column psu_tier_rank real;
alter table sff_parts add column psu_tier_source_url text not null default '';
alter table sff_parts add column psu_tier_source_sheet text not null default '';
alter table sff_parts add column psu_tier_source_row_number integer;
alter table sff_parts add column psu_tier_notes text not null default '';
