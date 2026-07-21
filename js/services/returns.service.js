// ============================================================
// RETURNS SERVICE — the only file that writes to `returns`.
// Orchestrates the cross-cutting effects of a return resolution:
//   - GOOD_CONDITION  -> restore stock (via InventoryService) + set
//                        order status to RETURNED
//   - APPEALED /
//     CLAIM_SUCCESSFUL -> set order status to RETURNED only, no
//                        stock impact (goods considered damaged/lost)
//
// Claim deadline = order_date + 30 days (Shopee's damage-claim
// window). Computed on the fly, never stored — it's fully derived
// from order_date and would go stale if cached.
// ============================================================

const CLAIM_WINDOW_DAYS = 30;

const ReturnsService = {
  /**
   * Search Shipped orders (that don't already have a return record)
   * by a partial Order SN or Tracking Number — matches anywhere in
   * the string, so typing the last 4-5 digits or first 4-5 digits
   * both work. Used for the "Add Return" autocomplete.
   */
  async searchEligibleOrders(term) {
    if (!term || term.trim().length < 3) return [];

    const { data: candidates, error } = await supabaseClient
      .from('orders')
      .select('id, order_sn, tracking_number, order_date, stores ( store_name ), validations!inner ( status )')
      .eq('validations.status', 'SHIPPED')
      .or(`order_sn.ilike.%${term.trim()}%,tracking_number.ilike.%${term.trim()}%`)
      .limit(15);
    if (error) throw error;
    if (!candidates.length) return [];

    // Exclude orders that already have a return record
    const candidateIds = candidates.map((c) => c.id);
    const { data: existingReturns, error: retErr } = await supabaseClient
      .from('returns')
      .select('order_id')
      .in('order_id', candidateIds);
    if (retErr) throw retErr;

    const alreadyReturned = new Set((existingReturns || []).map((r) => r.order_id));
    return candidates
      .filter((c) => !alreadyReturned.has(c.id))
      .map((c) => ({ ...c, store_name: c.stores?.store_name || null }));
  },

  /** Order + line items, for the "Add Return" detail preview */
  async getOrderDetail(orderId) {
    const { data: order, error: orderErr } = await supabaseClient
      .from('orders')
      .select('id, order_sn, tracking_number, order_date, stores ( store_name )')
      .eq('id', orderId)
      .single();
    if (orderErr) throw orderErr;

    const { data: items, error: itemsErr } = await supabaseClient
      .from('order_items')
      .select('sku_reference, product_name, variation, qty, unit_price, total_price')
      .eq('order_id', orderId);
    if (itemsErr) throw itemsErr;

    return { ...order, store_name: order.stores?.store_name || null, items: items || [] };
  },

  /** Create a new return record (status starts at PENDING) */
  async createReturn({ orderId, returnType, notes }) {
    const { data, error } = await supabaseClient
      .from('returns')
      .insert({ order_id: orderId, return_type: returnType, notes: notes || null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * All returns, joined with their order info, sorted by claim
   * urgency (soonest/most-overdue deadline first). Deadline is
   * computed here in JS from order_date, not stored.
   */
  async getAll() {
    const { data, error } = await supabaseClient
      .from('returns')
      .select('*, orders ( order_sn, tracking_number, order_date, stores ( store_name ) )')
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data || [])
      .map((r) => ({
        id: r.id,
        orderId: r.order_id,
        orderSn: r.orders.order_sn,
        trackingNumber: r.orders.tracking_number,
        orderDate: r.orders.order_date,
        storeName: r.orders.stores?.store_name || null,
        returnType: r.return_type,
        status: r.status,
        notes: r.notes,
        daysRemaining: daysRemaining(r.orders.order_date),
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  },

  /**
   * Change a return's status. Handles the cross-cutting effects:
   * GOOD_CONDITION restores stock (caller must confirm with the user
   * FIRST — this function assumes confirmation already happened) and
   * always flips the order's status to RETURNED once resolved.
   */
  async resolve(returnId, orderId, newStatus) {
    const { error: updErr } = await supabaseClient
      .from('returns')
      .update({ status: newStatus, resolved_at: new Date().toISOString() })
      .eq('id', returnId);
    if (updErr) throw updErr;

    if (newStatus === 'GOOD_CONDITION') {
      await InventoryService.restoreForOrders([orderId]);
    }

    // Any non-pending resolution means the order is no longer
    // meaningfully "Shipped" — it's on its way back, regardless of
    // the goods' condition.
    if (newStatus !== 'PENDING') {
      await OrderService.updateStatus(orderId, 'RETURNED');
    }
  },
};

/** Days left until order_date + 30. Negative = past the deadline. */
function daysRemaining(orderDate) {
  const deadline = new Date(orderDate);
  deadline.setDate(deadline.getDate() + CLAIM_WINDOW_DAYS);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.round((deadline - today) / (1000 * 60 * 60 * 24));
}

window.ReturnsService = ReturnsService;
