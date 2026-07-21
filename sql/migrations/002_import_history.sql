-- ============================================================
-- MIGRATION 002 — Import History (Bang Order v2.0, Feature #2)
-- Run this in Supabase SQL Editor if you already deployed Bang Order
-- v1.0 and are upgrading. Safe to re-run (all statements are
-- idempotent). Fresh installs can skip this — it's already folded
-- into sql/schema.sql.
--
-- What this adds:
--   - `import_batches` table: one row per (store, upload date),
--     recording how many NEW orders were created that day.
--   - `orders.batch_id`: tags each order with the upload batch it
--     came from, so we can later count "how many of today's printed
--     orders are now Cancelled" — live, without ever touching the
--     order data itself.
-- ============================================================

create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  upload_date date not null,
  file_name text,
  order_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, upload_date)
);

-- Tag orders with the batch (upload) they came from.
-- ON DELETE SET NULL: if old batch metadata is cleaned up after 7 days,
-- the order itself is untouched — it just loses the "which batch" tag.
alter table orders add column if not exists batch_id uuid references import_batches(id) on delete set null;

create index if not exists idx_import_batches_store_date on import_batches(store_id, upload_date);
create index if not exists idx_orders_batch on orders(batch_id);

alter table import_batches enable row level security;

do $$ begin
  create policy "Authenticated users can read import_batches" on import_batches
    for select using (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated users can write import_batches" on import_batches
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;
