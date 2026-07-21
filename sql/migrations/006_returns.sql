-- ============================================================
-- MIGRATION 006 — Returns (Bang Order v2.0, Feature #4)
-- Run in Supabase SQL Editor if upgrading an existing deployment
-- (after 002-005). NOTE: the ALTER TYPE statement below must be run
-- and COMMITTED before the rest of this file in some Postgres
-- versions — if you hit an error, run the first statement alone,
-- then run the remainder separately.
--
-- Design (confirmed in discussion before building):
--   - A return is per ORDER (not per SKU) — if an order has 5 SKUs,
--     all 5 are treated as returned together.
--   - Returns only apply to orders that are already Shipped — a
--     Cancelled order (pre-shipping) can never have a return, so
--     there's no overlap/double-restore risk with the existing
--     Cancelled <-> stock-restore logic.
--   - Stock is ONLY restored when return status becomes
--     'GOOD_CONDITION' (buyer confirms), and only after the user
--     confirms via a dialog. 'APPEALED' and 'CLAIM_SUCCESSFUL' are
--     for damaged/lost goods — deliberately NOT treated as restockable.
--   - Whenever return status leaves 'PENDING' (any of the 3 final
--     states), the order's own status becomes 'RETURNED' — because
--     the order is no longer meaningfully "Shipped" once it's on its
--     way back, regardless of the goods' condition.
--   - 'RETURNED' is NOT a manually selectable option in the Orders
--     page's quick status dropdown — it's only ever set by this
--     Returns workflow, so every Returned order always has a
--     corresponding row here to explain why.
-- ============================================================

alter type validation_status add value if not exists 'RETURNED';

do $$ begin
  create type return_type as enum (
    'BUYER_RETURN',     -- pembeli mengembalikan pesanan
    'FAILED_DELIVERY',  -- pengiriman gagal sampai ke pembeli
    'SHORT_SHIPMENT'    -- kekurangan jumlah kirim (beli 2, dikirim 1)
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type return_status as enum (
    'PENDING',           -- default, menunggu tindak lanjut
    'APPEALED',          -- Telah Banding — barang rusak, sedang diajukan ke Shopee
    'CLAIM_SUCCESSFUL',  -- Berhasil Diklaim — klaim cair, barang dianggap kerugian
    'GOOD_CONDITION'     -- Kondisi Baik — barang layak jual lagi, stok direstock
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

alter table returns enable row level security;

do $$ begin
  create policy "Authenticated users can read returns" on returns
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated users can write returns" on returns
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
