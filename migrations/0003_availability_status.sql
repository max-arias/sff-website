-- ============================================================================
-- SFF Builder v2 — Add normalized availability_status column to all tables
--
-- This column provides a structured "available" | "unavailable" marker
-- derived from the raw status/availability text during intake.
-- Raw `status` column is preserved as-is.
-- ============================================================================

alter table cases          add column availability_status text not null default 'available';
alter table gpus           add column availability_status text not null default 'available';
alter table cpu_coolers    add column availability_status text not null default 'available';
alter table fans           add column availability_status text not null default 'available';
alter table motherboards   add column availability_status text not null default 'available';
alter table psus           add column availability_status text not null default 'available';
alter table ram            add column availability_status text not null default 'available';
