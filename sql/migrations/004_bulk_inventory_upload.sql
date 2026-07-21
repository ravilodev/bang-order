-- ============================================================
-- MIGRATION 004 — Bulk Inventory Upload (Bang Order v2.0)
-- Run this in Supabase SQL Editor if upgrading an existing
-- deployment (after 002 and 003). Idempotent.
--
-- Adds a new movement type, BULK_SET, distinct from MANUAL_ADJUSTMENT:
-- it represents "stock was overwritten by a Shopee bulk-upload file"
-- rather than a one-off manual correction — keeps the audit trail
-- honest about where a stock change actually came from.
-- ============================================================

alter type inventory_movement_type add value if not exists 'BULK_SET';
