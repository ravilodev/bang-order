// ============================================================
// INVENTORY SERVICE — global per-SKU stock with a full movement
// ledger. This is the ONLY file that writes to `inventory` /
// `inventory_movements`.
//
// Stock changes automatically on the order lifecycle:
//   - Import (new order created)        -> ORDER_DEDUCT
//   - Order set to Cancelled             -> ORDER_RESTORE
//   - Cancelled order un-cancelled       -> ORDER_DEDUCT (again)
//   - Replace status                     -> no stock movement (neutral)
// SKUs not yet registered in `inventory` are silently skipped during
// deduct/restore (the order itself is never blocked) — callers get
// back the list of skipped SKUs so they can warn the user.
// ============================================================

const InventoryService = {
  /** All SKUs, sorted lowest-stock-first (surfaces low stock naturally) */
  async getAll() {
    const { data, error } = await supabaseClient
      .from('inventory')
      .select('*')
      .order('current_stock', { ascending: true });
    if (error) throw error;
    return data;
  },

  /** SKUs at or below their low-stock threshold */
  async getLowStock() {
    const all = await this.getAll();
    return all.filter((i) => i.current_stock <= i.low_stock_threshold);
  },

  /** Register a new SKU with a starting stock count (logged as RESTOCK) */
  async registerSku({ skuReference, productName, imageUrl, initialStock, lowStockThreshold }) {
    const { data: created, error: insErr } = await supabaseClient
      .from('inventory')
      .insert({
        sku_reference: skuReference.trim(),
        product_name: productName?.trim() || null,
        image_url: imageUrl?.trim() || null,
        current_stock: initialStock,
        low_stock_threshold: lowStockThreshold,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    if (initialStock !== 0) {
      await logMovement({
        skuReference: created.sku_reference,
        movementType: 'RESTOCK',
        qtyChange: initialStock,
        resultingStock: initialStock,
        note: 'Initial stock on registration',
      });
    }

    return created;
  },

  /** Update SKU metadata (name, threshold, image) — does NOT touch stock count */
  async updateSkuInfo(skuReference, { productName, imageUrl, lowStockThreshold }) {
    const { data, error } = await supabaseClient
      .from('inventory')
      .update({
        product_name: productName?.trim() || null,
        image_url: imageUrl?.trim() || null,
        low_stock_threshold: lowStockThreshold,
        updated_at: new Date().toISOString(),
      })
      .eq('sku_reference', skuReference)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Manual stock adjustment (restock top-up or correction), +/- qty */
  async adjustStock(skuReference, qtyChange, note = '') {
    const { data: current, error: getErr } = await supabaseClient
      .from('inventory')
      .select('current_stock')
      .eq('sku_reference', skuReference)
      .single();
    if (getErr) throw getErr;

    const newStock = current.current_stock + qtyChange;

    const { error: updErr } = await supabaseClient
      .from('inventory')
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq('sku_reference', skuReference);
    if (updErr) throw updErr;

    await logMovement({
      skuReference,
      movementType: 'MANUAL_ADJUSTMENT',
      qtyChange,
      resultingStock: newStock,
      note: note || (qtyChange > 0 ? 'Manual restock' : 'Manual correction'),
    });

    return newStock;
  },

  /** Movement history for one SKU, most recent first */
  async getMovementHistory(skuReference, limit = 50) {
    const { data, error } = await supabaseClient
      .from('inventory_movements')
      .select('*, orders ( order_sn )')
      .eq('sku_reference', skuReference)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  /**
   * Deduct stock for a batch of orders (import, or an order coming
   * back OUT of Cancelled status). Skips SKUs not registered in
   * inventory — returns which ones were skipped so the caller can warn.
   */
  async deductForOrders(orderIds) {
    return applyMovementForOrders(orderIds, 'ORDER_DEDUCT');
  },

  /**
   * Restore stock for a batch of orders (an order moving INTO
   * Cancelled status). Same skip-unregistered-SKU behavior as deduct.
   */
  async restoreForOrders(orderIds) {
    return applyMovementForOrders(orderIds, 'ORDER_RESTORE');
  },

  /**
   * Bulk register/update SKUs from a parsed Shopee "Mass Update Sales
   * Info" file. Existing SKUs have their stock OVERWRITTEN (not
   * added) to match the file — this is meant to sync Bang Order with
   * Shopee's current catalog snapshot, not accumulate on top of it.
   * SKUs not yet in Inventory are auto-registered with the stock from
   * the file. Product name is refreshed from the file either way.
   *
   * SKU matching is case-INSENSITIVE: Shopee's own export casing can
   * differ from what the seller typed in manually (e.g. "w36" in the
   * file vs "W36" already registered) — these must be treated as the
   * same SKU, not create a near-duplicate row. Whenever a match is
   * found, writes always use the DATABASE's existing casing, never the
   * file's, so the unique constraint and every other reference to that
   * SKU (order_items, inventory_movements) stays consistent.
   *
   * Returns { created, updated }
   */
  async bulkUpsertFromFile(rows) {
    if (!rows || !rows.length) return { created: 0, updated: 0 };

    // Fetch ALL existing SKUs (not a `.in()` exact match) so we can
    // compare case-insensitively in JS.
    const { data: existingRows, error: fetchErr } = await supabaseClient
      .from('inventory')
      .select('sku_reference, current_stock');
    if (fetchErr) throw fetchErr;

    const existingByLower = {};
    existingRows.forEach((r) => (existingByLower[r.sku_reference.toLowerCase()] = r));

    const toInsert = [];
    const toUpdate = []; // { skuReference (DB's existing casing), stock, productName }
    const movementRows = [];

    for (const row of rows) {
      const existing = existingByLower[row.sku_reference.toLowerCase()];
      if (existing) {
        if (existing.current_stock !== row.stock) {
          movementRows.push({
            sku_reference: existing.sku_reference, // DB casing, not the file's
            movement_type: 'BULK_SET',
            qty_change: row.stock - existing.current_stock,
            resulting_stock: row.stock,
            note: 'Bulk upload from Shopee export',
          });
        }
        toUpdate.push({ skuReference: existing.sku_reference, stock: row.stock, productName: row.product_name });
      } else {
        toInsert.push(row);
      }
    }

    // New SKUs: insert with default threshold, then log as RESTOCK
    // (same semantics as registering a single SKU manually).
    if (toInsert.length) {
      const { data: created, error: insErr } = await supabaseClient
        .from('inventory')
        .insert(
          toInsert.map((r) => ({
            sku_reference: r.sku_reference,
            product_name: r.product_name || null,
            current_stock: r.stock,
            low_stock_threshold: 5,
          }))
        )
        .select();
      if (insErr) throw insErr;

      created.forEach((c) => {
        if (c.current_stock !== 0) {
          movementRows.push({
            sku_reference: c.sku_reference,
            movement_type: 'RESTOCK',
            qty_change: c.current_stock,
            resulting_stock: c.current_stock,
            note: 'Registered via bulk upload from Shopee export',
          });
        }
      });
    }

    // Existing SKUs: overwrite stock + refresh product name — always
    // keyed by the DB's existing casing (see comment above).
    for (const row of toUpdate) {
      const { error: updErr } = await supabaseClient
        .from('inventory')
        .update({
          current_stock: row.stock,
          product_name: row.productName || null,
          updated_at: new Date().toISOString(),
        })
        .eq('sku_reference', row.skuReference);
      if (updErr) throw updErr;
    }

    if (movementRows.length) {
      const { error: movErr } = await supabaseClient.from('inventory_movements').insert(movementRows);
      if (movErr) throw movErr;
    }

    return { created: toInsert.length, updated: toUpdate.length };
  },
};

// ---------- Internal helpers ----------

async function logMovement({ skuReference, movementType, qtyChange, resultingStock, orderId = null, note = '' }) {
  const { error } = await supabaseClient.from('inventory_movements').insert({
    sku_reference: skuReference,
    movement_type: movementType,
    qty_change: qtyChange,
    resulting_stock: resultingStock,
    order_id: orderId,
    note,
  });
  if (error) throw error;
}

/**
 * Shared engine for deduct/restore. Processes order_items sequentially
 * so `resulting_stock` in the ledger is always an accurate snapshot,
 * even when several line items in this same batch share a SKU.
 */
async function applyMovementForOrders(orderIds, movementType) {
  if (!orderIds || !orderIds.length) return { skippedSkus: [] };

  const { data: items, error: itemsErr } = await supabaseClient
    .from('order_items')
    .select('order_id, sku_reference, qty')
    .in('order_id', orderIds);
  if (itemsErr) throw itemsErr;
  if (!items.length) return { skippedSkus: [] };

  const distinctSkus = [...new Set(items.map((i) => i.sku_reference))];
  const { data: inventoryRows, error: invErr } = await supabaseClient
    .from('inventory')
    .select('sku_reference, current_stock')
    .in('sku_reference', distinctSkus);
  if (invErr) throw invErr;

  const stockMap = {};
  inventoryRows.forEach((row) => (stockMap[row.sku_reference] = row.current_stock));

  const skippedSkus = new Set();
  const movementRows = [];
  const direction = movementType === 'ORDER_DEDUCT' ? -1 : 1;

  for (const item of items) {
    if (!(item.sku_reference in stockMap)) {
      skippedSkus.add(item.sku_reference);
      continue;
    }
    const change = direction * item.qty;
    stockMap[item.sku_reference] += change;
    movementRows.push({
      sku_reference: item.sku_reference,
      movement_type: movementType,
      qty_change: change,
      resulting_stock: stockMap[item.sku_reference],
      order_id: item.order_id,
    });
  }

  // Write final stock levels for every affected SKU
  const affectedSkus = Object.keys(stockMap).filter((sku) =>
    movementRows.some((m) => m.sku_reference === sku)
  );
  for (const sku of affectedSkus) {
    const { error: updErr } = await supabaseClient
      .from('inventory')
      .update({ current_stock: stockMap[sku], updated_at: new Date().toISOString() })
      .eq('sku_reference', sku);
    if (updErr) throw updErr;
  }

  if (movementRows.length) {
    const { error: movErr } = await supabaseClient.from('inventory_movements').insert(movementRows);
    if (movErr) throw movErr;
  }

  return { skippedSkus: Array.from(skippedSkus) };
}

window.InventoryService = InventoryService;
