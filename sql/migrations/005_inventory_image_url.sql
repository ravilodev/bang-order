-- ============================================================
-- MIGRATION 005 — SKU Image URL (Bang Order v2.0)
-- Run in Supabase SQL Editor if upgrading an existing deployment
-- (after 002, 003, 004). Idempotent.
--
-- Adds an optional `image_url` to `inventory` — a plain link the
-- user pastes in manually (e.g. from Shopee's CDN or Google Drive).
-- No file upload, no Supabase Storage — just a text field rendered
-- as an <img>, with a graceful fallback if the link is broken.
-- ============================================================

alter table inventory add column if not exists image_url text;
