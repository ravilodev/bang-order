// ============================================================
// IMPORT BATCH SERVICE — tracks "Resi Dicetak" history per upload
// day, with LIVE cancelled-count so sellers can match printed
// tracking numbers against what's actually being handed to the
// courier after same-day cancellations.
//
// Design:
//   - `printed` (order_count) is captured ONCE at upload time and
//     never changes — it's a historical fact ("N orders were
//     printed/imported that day").
//   - `cancelled` is recomputed every time history is read, based on
//     the CURRENT validation status of the orders tagged to that
//     batch — because a courier hand-off happens hours after
//     printing, and cancellations can come in during that window.
//   - Retention: only batch METADATA older than 7 days is cleaned up
//     lazily on read. The underlying orders are never deleted.
// ============================================================

const ImportBatchService = {
  /**
   * Record (or add to) today's upload batch for a store, then tag the
   * newly-created order ids with that batch. Call this right after
   * ImportService.saveRows() succeeds — only for orders that were
   * actually newly inserted (not duplicates).
   */
  async recordUpload({ storeId, fileName, newOrderCount, newOrderIds }) {
    if (!newOrderCount || !newOrderIds.length) return null;

    const today = localDateKey();

    const { data: existing, error: findErr } = await supabaseClient
      .from('import_batches')
      .select('*')
      .eq('store_id', storeId)
      .eq('upload_date', today)
      .maybeSingle();
    if (findErr) throw findErr;

    let batch;
    if (existing) {
      // Same-day re-upload: merge into the existing day's total rather
      // than creating a second row for the same date.
      const { data: updated, error: updErr } = await supabaseClient
        .from('import_batches')
        .update({
          order_count: existing.order_count + newOrderCount,
          file_name: fileName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (updErr) throw updErr;
      batch = updated;
    } else {
      const { data: created, error: insErr } = await supabaseClient
        .from('import_batches')
        .insert({ store_id: storeId, upload_date: today, file_name: fileName, order_count: newOrderCount })
        .select()
        .single();
      if (insErr) throw insErr;
      batch = created;
    }

    const { error: tagErr } = await supabaseClient
      .from('orders')
      .update({ batch_id: batch.id })
      .in('id', newOrderIds);
    if (tagErr) throw tagErr;

    return batch;
  },

  /**
   * Last 7 days of upload history for a store, each with a LIVE
   * cancelled count computed from current validation statuses.
   * Returns: [{ uploadDate, fileName, printed, cancelled, handedToCourier }]
   * (newest first)
   */
  async getHistory(storeId) {
    const retentionCutoff = dateKeyDaysAgo(6); // 7-day window, inclusive of today

    // Lazy cleanup: drop batch METADATA older than the window.
    // The orders themselves are untouched (ON DELETE SET NULL on batch_id).
    await supabaseClient
      .from('import_batches')
      .delete()
      .eq('store_id', storeId)
      .lt('upload_date', retentionCutoff);

    const { data: batches, error: batchErr } = await supabaseClient
      .from('import_batches')
      .select('*')
      .eq('store_id', storeId)
      .gte('upload_date', retentionCutoff)
      .order('upload_date', { ascending: false });
    if (batchErr) throw batchErr;
    if (!batches || !batches.length) return [];

    const batchIds = batches.map((b) => b.id);
    const { data: taggedOrders, error: ordErr } = await supabaseClient
      .from('orders')
      .select('batch_id, validations ( status )')
      .in('batch_id', batchIds);
    if (ordErr) throw ordErr;

    const cancelledByBatch = {};
    for (const o of taggedOrders || []) {
      if (o.validations?.status === 'CANCELLED') {
        cancelledByBatch[o.batch_id] = (cancelledByBatch[o.batch_id] || 0) + 1;
      }
    }

    return batches.map((b) => {
      const cancelled = cancelledByBatch[b.id] || 0;
      return {
        uploadDate: b.upload_date,
        fileName: b.file_name,
        printed: b.order_count,
        cancelled,
        handedToCourier: b.order_count - cancelled,
      };
    });
  },
};

/** Today's date as "YYYY-MM-DD" in the browser's local timezone. */
function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" for N days ago, local timezone. */
function dateKeyDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

window.ImportBatchService = ImportBatchService;
