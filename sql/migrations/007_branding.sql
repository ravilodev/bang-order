-- ============================================================
-- MIGRATION 007 — App Branding (Bang Order v2.1)
-- Run in Supabase SQL Editor if upgrading an existing deployment
-- (after 002-006). Idempotent.
--
-- Lets the buyer of this source code rebrand the app from their own
-- Settings page — no code edits needed. Single-row config table
-- (this app has one "tenant" per deployment, so no per-user scoping).
--
-- The logo is stored as a base64 data URL directly in the row rather
-- than in Supabase Storage — keeps the whole app dependent on
-- Postgres only, consistent with the rest of the architecture. A
-- small logo (a few hundred KB at most) is completely fine as text.
-- ============================================================

create table if not exists app_settings (
  id int primary key default 1,
  app_name text not null default 'Bang Order',
  logo_data_url text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, app_name)
values (1, 'Bang Order')
on conflict (id) do nothing;

alter table app_settings enable row level security;

do $$ begin
  create policy "Anyone can read app_settings" on app_settings
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated users can write app_settings" on app_settings
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated users can update app_settings" on app_settings
    for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
