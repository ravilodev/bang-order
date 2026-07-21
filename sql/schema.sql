-- ============================================================
-- BANG ORDER — SUPABASE SCHEMA
-- Run this once in Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ---------- ENUM ----------
do $$ begin
  create type validation_status as enum ('PENDING','SHIPPED','CANCELLED','REPLACE','RETURNED');
exception
  when duplicate_object then null;
end $$;

-- ---------- STORES ----------
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- ORDERS ----------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_sn text not null,
  tracking_number text,
  order_date date not null,
  created_at timestamptz not null default now(),
  unique (store_id, order_sn)
);

create index if not exists idx_orders_store_date on orders(store_id, order_date);

-- ---------- ORDER ITEMS ----------
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sku_reference text not null,
  product_name text,
  variation text,
  qty int not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) generated always as (qty * unit_price) stored
);

create index if not exists idx_order_items_order on order_items(order_id);

-- ---------- VALIDATIONS ----------
create table if not exists validations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  status validation_status not null default 'PENDING',
  notes text,
  updated_at timestamptz not null default now()
);

-- Note: validations rows are created explicitly by the app
-- (js/services/import.service.js) right after each order insert,
-- so no database trigger is used here — keeps the write path
-- visible in one place (the import pipeline) instead of hidden
-- in a trigger.

-- ---------- IMPORT BATCHES (v2.0 — Import History feature) ----------
-- One row per (store, upload date). Tracks how many NEW orders were
-- created by uploads on that date, so the Import page can show
-- "Resi Dicetak" (fixed at upload time) vs "Dibatalkan" (live count of
-- orders from that batch that are currently Cancelled).
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

create index if not exists idx_import_batches_store_date on import_batches(store_id, upload_date);

-- Tag each order with the batch (upload) it came from. ON DELETE SET
-- NULL: cleaning up old batch metadata (after the 7-day retention
-- window) never touches the order data itself.
alter table orders add column if not exists batch_id uuid references import_batches(id) on delete set null;

create index if not exists idx_orders_batch on orders(batch_id);

-- ---------- INVENTORY (v2.0 — Feature #3) ----------
-- Global per-SKU stock (not per store — one seller, one stock pool).
-- Auto-deducted on import, auto-restored when an order is Cancelled,
-- auto-deducted again if a Cancelled order is un-cancelled. Replace is
-- neutral (no movement) until the Return feature defines its stock
-- behavior. Every change is logged to inventory_movements for audit.

do $$ begin
  create type inventory_movement_type as enum (
    'RESTOCK',
    'MANUAL_ADJUSTMENT',
    'ORDER_DEDUCT',
    'ORDER_RESTORE',
    'BULK_SET'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  sku_reference text not null unique,
  product_name text,
  image_url text,
  current_stock int not null default 0,
  low_stock_threshold int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  sku_reference text not null references inventory(sku_reference) on delete cascade,
  movement_type inventory_movement_type not null,
  qty_change int not null,
  resulting_stock int not null,
  order_id uuid references orders(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_sku on inventory_movements(sku_reference, created_at desc);
create index if not exists idx_inventory_low_stock on inventory(current_stock, low_stock_threshold);

-- ---------- RETURNS (v2.0 — Feature #4) ----------
-- Per-ORDER (not per-SKU): if an order has 5 SKUs, all 5 are treated
-- as returned together. Only applies to already-Shipped orders — a
-- Cancelled (pre-shipping) order can never have a return.
-- Stock is only restored when status becomes GOOD_CONDITION, and only
-- after explicit user confirmation. APPEALED / CLAIM_SUCCESSFUL are
-- for damaged/lost goods and never restock. Any of the 3 final
-- statuses flips the order's own status to RETURNED.

do $$ begin
  create type return_type as enum (
    'BUYER_RETURN',
    'FAILED_DELIVERY',
    'SHORT_SHIPMENT'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type return_status as enum (
    'PENDING',
    'APPEALED',
    'CLAIM_SUCCESSFUL',
    'GOOD_CONDITION'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  return_type return_type not null,
  status return_status not null default 'PENDING',
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_returns_status on returns(status);

-- ---------- APP SETTINGS (v2.1 — Branding) ----------
-- Single-row config so buyers of this source code can rebrand the
-- app (name + logo) from Settings without touching code. Logo is a
-- base64 data URL stored directly in Postgres — no Supabase Storage
-- dependency, consistent with the rest of this app's architecture.

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

-- ---------- ROW LEVEL SECURITY ----------
-- Simple single-tenant policy: any authenticated user can read/write.
-- Tighten this if you support multiple sellers per project later.

alter table stores enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table validations enable row level security;
alter table import_batches enable row level security;
alter table inventory enable row level security;
alter table inventory_movements enable row level security;
alter table returns enable row level security;
alter table app_settings enable row level security;

create policy "Authenticated users can read stores" on stores
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can write stores" on stores
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can read orders" on orders
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can write orders" on orders
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can read order_items" on order_items
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can write order_items" on order_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can read validations" on validations
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can write validations" on validations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can read import_batches" on import_batches
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can write import_batches" on import_batches
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can read inventory" on inventory
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can write inventory" on inventory
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can read inventory_movements" on inventory_movements
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can write inventory_movements" on inventory_movements
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users can read returns" on returns
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can write returns" on returns
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Anyone can read app_settings" on app_settings
  for select using (true);
create policy "Authenticated users can insert app_settings" on app_settings
  for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update app_settings" on app_settings
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
