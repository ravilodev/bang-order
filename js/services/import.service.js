// ============================================================
// IMPORT SERVICE — orchestrates saving a batch of normalized,
// deduplicated order rows into orders / order_items / validations
// ============================================================

const ImportService = {
  /**
   * Group flat parsed rows by order_sn (one order can have multiple
   * SKU line items), then insert orders -> order_items -> validations.
   * Also records the upload in import_batches (Feature #2 — Import
   * History) so the Import page can show "Resi Dicetak" vs
   * "Dibatalkan" per upload day.
   *
   * Core data (orders/items/validations) is written first and throws
   * normally on failure — if any of that fails, nothing was saved and
   * the caller's "import failed" message is accurate.
   *
   * The two steps AFTER that (batch tracking, inventory deduction) are
   * secondary side-effects. If either of them fails, the orders are
   * already safely saved — throwing at that point would make the UI
   * say "import failed" when orders actually went through, which could
   * mislead the user into re-uploading (and having them silently
   * skipped as "duplicates" next time, with the original problem never
   * fixed). So these are caught individually and reported honestly in
   * the return value instead.
   *
   * Returns { ordersCreated, itemsCreated, skippedSkus, batchRecordFailed, inventoryDeductFailed }
   */
  async saveRows(storeId, rows, fileName = null) {
    const grouped = groupByOrderSn(rows);
    const orderSns = Object.keys(grouped);
    let ordersCreated = 0;
    let itemsCreated = 0;

    // Insert orders in one batch
    const orderPayload = orderSns.map((sn) => {
      const first = grouped[sn][0];
      return {
        store_id: storeId,
        order_sn: sn,
        tracking_number: first.tracking_number,
        order_date: first.order_date,
      };
    });

    const { data: insertedOrders, error: orderErr } = await supabaseClient
      .from('orders')
      .insert(orderPayload)
      .select('id, order_sn');
    if (orderErr) throw orderErr;
    ordersCreated = insertedOrders.length;

    const orderIdBySn = {};
    insertedOrders.forEach((o) => (orderIdBySn[o.order_sn] = o.id));

    // Insert order_items in one batch
    const itemPayload = [];
    for (const sn of orderSns) {
      const orderId = orderIdBySn[sn];
      for (const row of grouped[sn]) {
        itemPayload.push({
          order_id: orderId,
          sku_reference: row.sku_reference,
          product_name: row.product_name,
          variation: row.variation,
          qty: row.qty,
          unit_price: row.unit_price,
        });
      }
    }

    const { data: insertedItems, error: itemErr } = await supabaseClient
      .from('order_items')
      .insert(itemPayload)
      .select('id');
    if (itemErr) throw itemErr;
    itemsCreated = insertedItems.length;

    // Insert validations (default PENDING) for each new order
    const validationPayload = insertedOrders.map((o) => ({
      order_id: o.id,
      status: 'PENDING',
    }));
    const { error: valErr } = await supabaseClient.from('validations').insert(validationPayload);
    if (valErr) throw valErr;

    // --- Everything above is "core" — if we got this far, the orders
    // are genuinely saved. Everything below is best-effort. ---

    let batchRecordFailed = false;
    let inventoryDeductFailed = false;
    let skippedSkus = [];

    // Feature #2 — Import History: record today's upload count and tag
    // these new orders with the batch.
    try {
      await ImportBatchService.recordUpload({
        storeId,
        fileName,
        newOrderCount: insertedOrders.length,
        newOrderIds: insertedOrders.map((o) => o.id),
      });
    } catch (err) {
      console.error('[Bang Order] Failed to record import batch history:', err);
      batchRecordFailed = true;
    }

    // Feature #3 — Inventory: deduct stock for the newly created orders.
    // Unregistered SKUs are skipped (not blocked) — returned so the
    // import page can warn the user which SKUs still need registering.
    try {
      const result = await InventoryService.deductForOrders(insertedOrders.map((o) => o.id));
      skippedSkus = result.skippedSkus;
    } catch (err) {
      console.error('[Bang Order] Failed to deduct inventory for import:', err);
      inventoryDeductFailed = true;
    }

    return { ordersCreated, itemsCreated, skippedSkus, batchRecordFailed, inventoryDeductFailed };
  },
};

function groupByOrderSn(rows) {
  const groups = {};
  for (const row of rows) {
    if (!groups[row.order_sn]) groups[row.order_sn] = [];
    groups[row.order_sn].push(row);
  }
  return groups;
}

window.ImportService = ImportService;
