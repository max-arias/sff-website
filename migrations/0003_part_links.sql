alter table sff_parts add column seller_url text not null default '';
alter table sff_parts add column product_url text not null default '';
alter table sff_parts add column links_json text not null default '{}';

alter table sff_part_source_rows add column links_json text not null default '{}';
