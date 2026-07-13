-- ============================================================================
-- SFF Builder v2 — Add PSU tier columns to psus table
-- ============================================================================

alter table psus add column psu_tier text not null default '';
alter table psus add column psu_tier_rank real;
alter table psus add column psu_tier_efficiency text not null default '';
