-- ============================================================
-- BANG ORDER — SUPABASE SCHEMA
-- Run this once in Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ---------- ENUM ----------
do $$ begin
  create type validation_status as enum ('PENDING','SHIPPED','CANCELLED','REPLACE');
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

-- ---------- ROW LEVEL SECURITY ----------
-- Simple single-tenant policy: any authenticated user can read/write.
-- Tighten this if you support multiple sellers per project later.

alter table stores enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table validations enable row level security;

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
