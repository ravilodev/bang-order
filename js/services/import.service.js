// ============================================================
// IMPORT SERVICE — orchestrates saving a batch of normalized,
// deduplicated order rows into orders / order_items / validations
// ============================================================

const ImportService = {
  /**
   * Group flat parsed rows by order_sn (one order can have multiple
   * SKU line items), then insert orders -> order_items -> validations.
   * Returns { ordersCreated, itemsCreated }
   */
  async saveRows(storeId, rows) {
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

    return { ordersCreated, itemsCreated };
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
