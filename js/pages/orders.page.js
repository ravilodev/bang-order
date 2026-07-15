// ============================================================
// ORDERS PAGE CONTROLLER
// ============================================================

(async function initOrders() {
  await AuthService.requireSession();
  const content = await Shell.render({
    active: 'orders',
    title: 'Orders',
    subtitle: 'Recap and validate fulfillment status for imported orders',
  });

  content.insertAdjacentHTML(
    'beforeend',
    `
    <div class="table-toolbar">
      <div class="input-icon-wrap table-toolbar__search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="input" id="order-search" placeholder="Search order SN, tracking, or SKU..." />
      </div>
      <div class="table-toolbar__filters">
        <select class="select" id="store-filter" style="max-width:200px;">
          <option value="">All Stores</option>
        </select>
        <select class="select" id="status-filter" style="max-width:160px;">
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="SHIPPED">Shipped</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REPLACE">Replace</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="refresh-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh
        </button>
      </div>
    </div>
    <div id="orders-table-mount"></div>
    `
  );

  let allRows = [];
  let statusFilter = '';

  const table = new DataTable({
    mount: document.getElementById('orders-table-mount'),
    pageSize: 10,
    emptyState: {
      title: 'No orders yet',
      message: 'Import a Shopee Excel file to see orders here.',
    },
    searchMatch: (row, term) =>
      row.order_sn.toLowerCase().includes(term) ||
      (row.tracking_number || '').toLowerCase().includes(term) ||
      row.sku_reference.toLowerCase().includes(term),
    columns: [
      { key: 'tracking_number', label: 'Tracking Number', sortable: true, render: (r) => r.tracking_number || '<span class="text-muted">—</span>' },
      { key: 'order_sn', label: 'Order SN', sortable: true, render: (r) => `<strong>${r.order_sn}</strong>` },
      { key: 'order_date', label: 'Order Date', sortable: true, render: (r) => Formatters.formatDate(r.order_date) },
      { key: 'sku_reference', label: 'SKU Reference', sortable: true, wrap: true, render: (r) => Formatters.truncate(r.sku_reference, 22) },
      { key: 'qty', label: 'Qty', sortable: true, align: 'right', render: (r) => Formatters.formatNumber(r.qty) },
      { key: 'unit_price', label: 'Unit Price', sortable: true, align: 'right', render: (r) => Formatters.formatCurrency(r.unit_price) },
      { key: 'total_price', label: 'Total Price', sortable: true, align: 'right', render: (r) => Formatters.formatCurrency(r.total_price) },
      { key: 'status', label: 'Validation Status', sortable: true, render: (r) => StatusBadge.renderSelect(r.status, r.order_id) },
      { key: 'notes', label: 'Notes', wrap: true, render: (r) => `<input class="notes-input" data-role="notes-input" data-order-id="${r.order_id}" value="${(r.notes || '').replace(/"/g, '&quot;')}" placeholder="Add note..." />` },
      { key: 'actions', label: '', render: () => '' },
    ],
  });

  table.onRowsRendered = (rows) => {
    table.mount.querySelectorAll('[data-role="status-select"]').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        const orderId = e.target.dataset.orderId;
        const newStatus = e.target.value;
        e.target.className = `status-select ${StatusBadge.meta(newStatus).selectClass}`;
        try {
          await OrderService.updateStatus(orderId, newStatus);
          const row = allRows.find((r) => r.order_id === orderId);
          if (row) row.status = newStatus;
          Toast.success('Status updated');
        } catch (err) {
          console.error(err);
          Toast.error('Failed to update status');
        }
      });
    });

    table.mount.querySelectorAll('[data-role="notes-input"]').forEach((input) => {
      let debounceTimer;
      input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const orderId = e.target.dataset.orderId;
        const value = e.target.value;
        debounceTimer = setTimeout(async () => {
          try {
            await OrderService.updateNotes(orderId, value);
            const row = allRows.find((r) => r.order_id === orderId);
            if (row) row.notes = value;
            Toast.success('Note saved');
          } catch (err) {
            console.error(err);
            Toast.error('Failed to save note');
          }
        }, 600);
      });
    });
  };

  document.getElementById('order-search').addEventListener('input', (e) => table.setSearchTerm(e.target.value));
  document.getElementById('status-filter').addEventListener('change', (e) => {
    statusFilter = e.target.value;
    applyStatusFilter();
  });
  document.getElementById('refresh-btn').addEventListener('click', loadOrders);
  document.getElementById('store-filter').addEventListener('change', loadOrders);

  function applyStatusFilter() {
    const filtered = statusFilter ? allRows.filter((r) => r.status === statusFilter) : allRows;
    table.setData(filtered);
  }

  async function loadOrders() {
    table.showLoading();
    const storeId = document.getElementById('store-filter').value || null;
    try {
      allRows = await OrderService.getOrderRows({ storeId });
      applyStatusFilter();
    } catch (err) {
      console.error(err);
      Toast.error('Failed to load orders');
    }
  }

  // Populate store dropdown
  const stores = await StoreService.getActiveStores();
  const storeSelect = document.getElementById('store-filter');
  stores.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.store_name;
    storeSelect.appendChild(opt);
  });

  loadOrders();
})();
