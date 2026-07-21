-- ============================================================
-- MIGRATION 003 — Inventory (Bang Order v2.0, Feature #3)
-- Run this in Supabase SQL Editor if upgrading an existing
-- deployment. Idempotent — safe to re-run. Fresh installs can skip
-- this, it's already folded into sql/schema.sql.
--
-- Design decisions (confirmed in discussion before building):
--   - Stock is GLOBAL per SKU, not per store (one seller, one stock
--     pool, even across multiple Shopee stores).
--   - Auto-deducted when an order is imported; auto-RESTORED when an
--     order is set to Cancelled; auto-deducted again if a Cancelled
--     order is changed back to any other status. Replace is treated
--     as neutral (no stock movement) until the Return feature (#4)
--     defines what a replacement actually consumes.
--   - Orders referencing a SKU that isn't registered in `inventory`
--     yet are NOT blocked — the import still succeeds, that specific
--     SKU's deduction is skipped, and the caller is told which SKUs
--     were skipped so it can warn the user.
--   - Every stock change (import deduction, cancellation restore,
--     manual restock/adjustment) is logged to `inventory_movements`
--     for a full audit trail.
-- ============================================================

do $$ begin
  create type inventory_movement_type as enum (
    'RESTOCK',            -- manual stock addition (incl. initial registration)
    'MANUAL_ADJUSTMENT',  -- manual correction, positive or negative
    'ORDER_DEDUCT',       -- stock consumed by a non-cancelled order
    'ORDER_RESTORE'       -- stock returned because an order was cancelled
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  sku_reference text not null unique,
  product_name text,
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

alter table inventory enable row level security;
alter table inventory_movements enable row level security;

do $$ begin
  create policy "Authenticated users can read inventory" on inventory
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated users can write inventory" on inventory
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated users can read inventory_movements" on inventory_movements
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated users can write inventory_movements" on inventory_movements
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
