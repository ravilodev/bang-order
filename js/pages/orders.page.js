// ============================================================
// ORDERS PAGE CONTROLLER
// ============================================================

(async function initOrders() {
  await AuthService.requireSession();
  const content = await Shell.render({
    active: 'orders',
    titleKey: 'orders.title',
    subtitleKey: 'orders.subtitle',
  });

  content.insertAdjacentHTML(
    'beforeend',
    `
    <div class="table-toolbar">
      <div class="input-icon-wrap table-toolbar__search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="input" id="order-search" placeholder="${t('orders.searchPlaceholder')}" />
      </div>
      <div class="table-toolbar__filters">
        <select class="select" id="store-filter" style="max-width:200px;">
          <option value="">${t('common.allStores')}</option>
        </select>
        <select class="select" id="status-filter" style="max-width:160px;">
          <option value="">${t('common.allStatus')}</option>
          <option value="PENDING">${t('statusBadge.PENDING')}</option>
          <option value="SHIPPED">${t('statusBadge.SHIPPED')}</option>
          <option value="CANCELLED">${t('statusBadge.CANCELLED')}</option>
          <option value="REPLACE">${t('statusBadge.REPLACE')}</option>
          <option value="RETURNED">${t('statusBadge.RETURNED')}</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="refresh-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          ${t('common.refresh')}
        </button>
      </div>
    </div>
    <div class="bulk-toolbar" id="bulk-toolbar">
      <span class="bulk-toolbar__count" id="bulk-toolbar-count">${t('orders.bulk.selected', { n: 0 })}</span>
      <div class="bulk-toolbar__actions">
        <span class="text-secondary" style="font-size:13px;">${t('orders.bulk.setStatusTo')}</span>
        <button class="btn btn-secondary btn-sm" data-bulk-status="PENDING">${t('statusBadge.PENDING')}</button>
        <button class="btn btn-success btn-sm" data-bulk-status="SHIPPED">${t('statusBadge.SHIPPED')}</button>
        <button class="btn btn-danger btn-sm" data-bulk-status="CANCELLED">${t('statusBadge.CANCELLED')}</button>
        <button class="btn btn-sm" data-bulk-status="REPLACE" style="background:var(--color-replace); color:#fff;">${t('statusBadge.REPLACE')}</button>
        <button class="btn btn-ghost btn-sm" id="clear-selection-btn">${t('orders.bulk.clearSelection')}</button>
      </div>
    </div>
    <div id="orders-table-mount"></div>
    `
  );

  let allRows = [];
  let statusFilter = '';
  let selectedIds = new Set();
  let currentPageRows = [];

  const table = new DataTable({
    mount: document.getElementById('orders-table-mount'),
    pageSize: 100,
    emptyState: {
      title: t('orders.empty.title'),
      message: t('orders.empty.message'),
    },
    searchMatch: (row, term) =>
      row.order_sn.toLowerCase().includes(term) ||
      (row.tracking_number || '').toLowerCase().includes(term) ||
      row.sku_reference.toLowerCase().includes(term),
    columns: [
      {
        key: 'select',
        label: '<input type="checkbox" id="select-all-checkbox" title="Select all on this page" />',
        sortable: false,
        className: 'checkbox-cell',
        render: (r) => r.status === 'RETURNED'
          ? `<input type="checkbox" class="row-checkbox" disabled title="Returned orders are managed from the Returns page" />`
          : `<input type="checkbox" class="row-checkbox" data-order-id="${r.order_id}" ${selectedIds.has(r.order_id) ? 'checked' : ''} />`,
      },
      { key: 'tracking_number', label: t('orders.table.trackingNumber'), sortable: true, render: (r) => r.tracking_number || '<span class="text-muted">—</span>' },
      { key: 'order_sn', label: t('orders.table.orderSn'), sortable: true, render: (r) => `<strong>${r.order_sn}</strong>` },
      { key: 'order_date', label: t('orders.table.orderDate'), sortable: true, render: (r) => Formatters.formatDate(r.order_date) },
      { key: 'sku_reference', label: t('orders.table.skuReference'), sortable: true, wrap: true, render: (r) => Formatters.truncate(r.sku_reference, 22) },
      { key: 'qty', label: t('orders.table.qty'), sortable: true, align: 'right', render: (r) => Formatters.formatNumber(r.qty) },
      { key: 'unit_price', label: t('orders.table.unitPrice'), sortable: true, align: 'right', render: (r) => Formatters.formatCurrency(r.unit_price) },
      { key: 'total_price', label: t('orders.table.totalPrice'), sortable: true, align: 'right', render: (r) => Formatters.formatCurrency(r.total_price) },
      { key: 'status', label: t('orders.table.validationStatus'), sortable: true, render: (r) => (r.status === 'RETURNED' ? StatusBadge.render(r.status) : StatusBadge.renderSelect(r.status, r.order_id)) },
      { key: 'notes', label: t('orders.table.notes'), wrap: true, render: (r) => `<input class="notes-input" data-role="notes-input" data-order-id="${r.order_id}" value="${(r.notes || '').replace(/"/g, '&quot;')}" placeholder="${t('orders.table.notesPlaceholder')}" />` },
      { key: 'actions', label: '', render: () => '' },
    ],
  });

  // Apply a status to every in-memory row + every visible <select> that
  // shares the same order_id (a single order can span multiple rows —
  // one per SKU — and they must all reflect the same validation status).
  function syncStatusEverywhere(orderId, newStatus) {
    allRows.filter((r) => r.order_id === orderId).forEach((r) => (r.status = newStatus));
    table.mount.querySelectorAll(`[data-role="status-select"][data-order-id="${orderId}"]`).forEach((sel) => {
      sel.value = newStatus;
      sel.className = `status-select ${StatusBadge.meta(newStatus).selectClass}`;
    });
  }

  function updateBulkToolbar() {
    const toolbar = document.getElementById('bulk-toolbar');
    const countLabel = document.getElementById('bulk-toolbar-count');
    if (selectedIds.size > 0) {
      toolbar.classList.add('visible');
      countLabel.textContent = t('orders.bulk.selected', { n: selectedIds.size });
    } else {
      toolbar.classList.remove('visible');
    }
  }

  function syncSelectAllCheckbox() {
    const selectAllCb = document.getElementById('select-all-checkbox');
    if (!selectAllCb || !currentPageRows.length) return;
    const allChecked = currentPageRows.every((r) => selectedIds.has(r.order_id));
    const someChecked = currentPageRows.some((r) => selectedIds.has(r.order_id));
    selectAllCb.checked = allChecked;
    selectAllCb.indeterminate = !allChecked && someChecked;
  }

  // Decide what an order's status transition means for stock:
  // moving INTO Cancelled restores stock, moving OUT OF Cancelled
  // deducts it again. Any other transition (incl. Replace) is neutral.
  function inventoryActionFor(previousStatus, newStatus) {
    if (newStatus === 'CANCELLED' && previousStatus !== 'CANCELLED') return 'RESTORE';
    if (previousStatus === 'CANCELLED' && newStatus !== 'CANCELLED') return 'DEDUCT';
    return null;
  }

  table.onRowsRendered = (rows) => {
    currentPageRows = rows;
    // Selection is scoped to "what's currently on screen" — a fresh
    // search, sort, or page change starts a new selection.
    selectedIds.clear();
    updateBulkToolbar();

    table.mount.querySelectorAll('[data-role="status-select"]').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        const orderId = e.target.dataset.orderId;
        const newStatus = e.target.value;
        const previousStatus = allRows.find((r) => r.order_id === orderId)?.status;

        // Write the status FIRST. Only touch the UI once we know it
        // actually succeeded — otherwise a failed write would leave the
        // dropdown showing a status the database never actually has.
        try {
          await OrderService.updateStatus(orderId, newStatus);
        } catch (err) {
          console.error(err);
          Toast.error(t('orders.toast.statusUpdateFailed'));
          e.target.value = previousStatus; // native <select> already shows newStatus — revert it
          return;
        }

        syncStatusEverywhere(orderId, newStatus);

        // Inventory is a separate step with its own failure mode: the
        // status change above already succeeded and is NOT rolled back,
        // so if this part fails we say so honestly instead of implying
        // nothing happened — a retry of the same status wouldn't
        // re-trigger this step since no transition would be detected.
        const action = inventoryActionFor(previousStatus, newStatus);
        if (!action) {
          Toast.success(t('orders.toast.statusUpdated'));
          return;
        }
        try {
          if (action === 'RESTORE') await InventoryService.restoreForOrders([orderId]);
          else await InventoryService.deductForOrders([orderId]);
          Toast.success(t('orders.toast.statusUpdated'));
        } catch (err) {
          console.error(err);
          Toast.error(t('orders.toast.statusUpdatedInventoryFailed'));
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
            Toast.success(t('orders.toast.noteSaved'));
          } catch (err) {
            console.error(err);
            Toast.error(t('orders.toast.noteSaveFailed'));
          }
        }, 600);
      });
    });

    table.mount.querySelectorAll('.row-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const orderId = e.target.dataset.orderId;
        if (e.target.checked) selectedIds.add(orderId);
        else selectedIds.delete(orderId);
        // Keep sibling rows of the same multi-SKU order visually in sync.
        table.mount.querySelectorAll(`.row-checkbox[data-order-id="${orderId}"]`).forEach((sib) => {
          sib.checked = e.target.checked;
        });
        syncSelectAllCheckbox();
        updateBulkToolbar();
      });
    });

    syncSelectAllCheckbox();
  };

  // Header "select all" checkbox persists across re-renders (only tbody
  // is rebuilt), so it's wired once here rather than inside onRowsRendered.
  table.mount.querySelector('#select-all-checkbox')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    currentPageRows.forEach((r) => {
      if (checked) selectedIds.add(r.order_id);
      else selectedIds.delete(r.order_id);
    });
    table.mount.querySelectorAll('.row-checkbox').forEach((cb) => {
      cb.checked = selectedIds.has(cb.dataset.orderId);
    });
    updateBulkToolbar();
  });

  document.querySelectorAll('[data-bulk-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!selectedIds.size) return;
      const newStatus = btn.dataset.bulkStatus;
      const ids = Array.from(selectedIds);
      const statusLabel = t(`statusBadge.${newStatus}`);

      ConfirmDialog.open({
        title: t('orders.bulk.confirmTitle', { n: ids.length }),
        message: t('orders.bulk.confirmMessage', { n: ids.length, status: statusLabel }),
        confirmLabel: t('orders.bulk.setStatusButton', { status: statusLabel }),
        danger: newStatus === 'CANCELLED',
        onConfirm: async () => {
          // Capture previous statuses BEFORE mutating, to know which
          // orders need a stock restore vs a re-deduct.
          const toRestore = [];
          const toDeduct = [];
          ids.forEach((orderId) => {
            const previousStatus = allRows.find((r) => r.order_id === orderId)?.status;
            const action = inventoryActionFor(previousStatus, newStatus);
            if (action === 'RESTORE') toRestore.push(orderId);
            else if (action === 'DEDUCT') toDeduct.push(orderId);
          });

          try {
            await OrderService.updateStatusBulk(ids, newStatus);
          } catch (err) {
            console.error(err);
            Toast.error(t('orders.toast.bulkUpdateFailed'));
            return; // nothing was written — safe to just stop here
          }

          // Status write succeeded — sync the UI regardless of what
          // happens to inventory next, since the DB now genuinely
          // reflects the new status for all of these orders.
          ids.forEach((orderId) => syncStatusEverywhere(orderId, newStatus));
          selectedIds.clear();
          updateBulkToolbar();
          syncSelectAllCheckbox();
          table.mount.querySelectorAll('.row-checkbox').forEach((cb) => (cb.checked = false));

          try {
            if (toRestore.length) await InventoryService.restoreForOrders(toRestore);
            if (toDeduct.length) await InventoryService.deductForOrders(toDeduct);
            Toast.success(t('orders.toast.bulkUpdated', { n: ids.length, status: statusLabel }));
          } catch (err) {
            console.error(err);
            Toast.error(t('orders.toast.bulkUpdatedInventoryFailed', { n: ids.length }));
          }
        },
      });
    });
  });

  document.getElementById('clear-selection-btn').addEventListener('click', () => {
    selectedIds.clear();
    table.mount.querySelectorAll('.row-checkbox').forEach((cb) => (cb.checked = false));
    syncSelectAllCheckbox();
    updateBulkToolbar();
  });

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
      Toast.error(t('orders.toast.loadFailed'));
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
