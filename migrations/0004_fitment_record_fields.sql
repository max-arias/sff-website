-- Canonical fitment fields missing from the original per-kind schema.
alter table motherboards add column form_factor text not null default '';
alter table cpu_coolers add column ram_clearance_raw text not null default '';
