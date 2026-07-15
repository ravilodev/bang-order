// ============================================================
// DASHBOARD SERVICE — aggregation only. Reuses OrderService for
// data access so there is a single source of truth for reads.
// ============================================================

const DashboardService = {
  /**
   * Compute all dashboard metrics for a given store + date range.
   * dateFrom/dateTo: 'YYYY-MM-DD' strings or null for "all time".
   */
  async getMetrics({ storeId = null, dateFrom = null, dateTo = null } = {}) {
    const rows = await OrderService.getOrderRows({ storeId, dateFrom, dateTo });

    const uniqueOrderIds = new Set(rows.map((r) => r.order_id));
    const totalOrders = uniqueOrderIds.size;
    const totalItemsSold = rows.reduce((sum, r) => sum + Number(r.qty || 0), 0);
    const totalRevenue = rows.reduce((sum, r) => sum + Number(r.total_price || 0), 0);
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalOrders,
      totalItemsSold,
      totalRevenue,
      aov,
      dailySales: buildDailySales(rows),
      bestSellingSku: buildBestSellingSku(rows),
      ordersPerDay: buildOrdersPerDay(rows),
      orderStatus: buildOrderStatus(rows),
    };
  },
};

function buildDailySales(rows) {
  const byDate = {};
  for (const r of rows) {
    const key = Formatters.toDateKey(r.order_date);
    if (!key) continue;
    byDate[key] = (byDate[key] || 0) + Number(r.total_price || 0);
  }
  const dates = Object.keys(byDate).sort();
  return { labels: dates, values: dates.map((d) => byDate[d]) };
}

function buildOrdersPerDay(rows) {
  const byDate = {};
  const seenPerDate = {};
  for (const r of rows) {
    const key = Formatters.toDateKey(r.order_date);
    if (!key) continue;
    if (!seenPerDate[key]) seenPerDate[key] = new Set();
    seenPerDate[key].add(r.order_id);
  }
  for (const key in seenPerDate) byDate[key] = seenPerDate[key].size;
  const dates = Object.keys(byDate).sort();
  return { labels: dates, values: dates.map((d) => byDate[d]) };
}

function buildBestSellingSku(rows) {
  const bySku = {};
  for (const r of rows) {
    const key = r.sku_reference || 'Unknown';
    bySku[key] = (bySku[key] || 0) + Number(r.qty || 0);
  }
  const sorted = Object.entries(bySku).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return { labels: sorted.map((s) => s[0]), values: sorted.map((s) => s[1]) };
}

function buildOrderStatus(rows) {
  const byStatus = { PENDING: 0, SHIPPED: 0, CANCELLED: 0, REPLACE: 0 };
  const countedOrders = new Set();
  for (const r of rows) {
    if (countedOrders.has(r.order_id)) continue;
    countedOrders.add(r.order_id);
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }
  return byStatus;
}

window.DashboardService = DashboardService;
