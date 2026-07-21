// ============================================================
// ORDER SERVICE — reads/writes orders, order_items, validations
// The Orders table is rendered one row per order_item (joined with
// its parent order + validation), matching the product spec.
// ============================================================

const OrderService = {
  /**
   * Fetch flattened order rows for a store within an optional date range.
   * Returns array of:
   * { item_id, order_id, tracking_number, order_sn, order_date,
   *   sku_reference, product_name, variation, qty, unit_price, total_price,
   *   status, notes }
   */
  async getOrderRows({ storeId = null, dateFrom = null, dateTo = null } = {}) {
    let query = supabaseClient
      .from('order_items')
      .select(`
        id,
        sku_reference,
        product_name,
        variation,
        qty,
        unit_price,
        total_price,
        orders!inner (
          id,
          order_sn,
          tracking_number,
          order_date,
          store_id,
          validations ( status, notes )
        )
      `)
      .order('order_date', { ascending: false, foreignTable: 'orders' });

    if (storeId) query = query.eq('orders.store_id', storeId);
    if (dateFrom) query = query.gte('orders.order_date', dateFrom);
    if (dateTo) query = query.lte('orders.order_date', dateTo);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row) => ({
      item_id: row.id,
      order_id: row.orders.id,
      order_sn: row.orders.order_sn,
      tracking_number: row.orders.tracking_number,
      order_date: row.orders.order_date,
      sku_reference: row.sku_reference,
      product_name: row.product_name,
      variation: row.variation,
      qty: row.qty,
      unit_price: row.unit_price,
      total_price: row.total_price,
      status: row.orders.validations?.status || 'PENDING',
      notes: row.orders.validations?.notes || '',
    }));
  },

  /** Update validation status for an order (instant, no reload) */
  async updateStatus(orderId, status) {
    const { error } = await supabaseClient
      .from('validations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('order_id', orderId);
    if (error) throw error;
  },

  /**
   * Update validation status for many orders at once (batch edit).
   * Single query via `.in()` instead of one request per order —
   * important once sellers are validating hundreds of orders at a time.
   */
  async updateStatusBulk(orderIds, status) {
    if (!orderIds.length) return;
    const { error } = await supabaseClient
      .from('validations')
      .update({ status, updated_at: new Date().toISOString() })
      .in('order_id', orderIds);
    if (error) throw error;
  },

  /** Update notes for an order */
  async updateNotes(orderId, notes) {
    const { error } = await supabaseClient
      .from('validations')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('order_id', orderId);
    if (error) throw error;
  },

  /** Existing order_sn values for a store (used by import duplicate-check) */
  async getExistingOrderSns(storeId) {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('order_sn')
      .eq('store_id', storeId);
    if (error) throw error;
    return new Set((data || []).map((r) => r.order_sn));
  },
};

window.OrderService = OrderService;
