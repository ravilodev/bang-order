// ============================================================
// RETURNS PAGE CONTROLLER
// ============================================================

const RETURN_STATUS_BADGE_CLASS = {
  PENDING: 'badge-return-pending',
  APPEALED: 'badge-return-appealed',
  CLAIM_SUCCESSFUL: 'badge-return-claimed',
  GOOD_CONDITION: 'badge-return-good',
};

(async function initReturns() {
  await AuthService.requireSession();
  const content = await Shell.render({
    active: 'returns',
    titleKey: 'returns.title',
    subtitleKey: 'returns.subtitle',
  });

  content.insertAdjacentHTML(
    'beforeend',
    `
    <div class="table-toolbar">
      <div class="input-icon-wrap table-toolbar__search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="input" id="returns-search" placeholder="${t('returns.searchPlaceholder')}" />
      </div>
      <div class="table-toolbar__filters">
        <select class="select" id="returns-status-filter" style="max-width:180px;">
          <option value="">${t('common.allStatus')}</option>
          <option value="PENDING">${t('returns.statuses.PENDING')}</option>
          <option value="APPEALED">${t('returns.statuses.APPEALED')}</option>
          <option value="CLAIM_SUCCESSFUL">${t('returns.statuses.CLAIM_SUCCESSFUL')}</option>
          <option value="GOOD_CONDITION">${t('returns.statuses.GOOD_CONDITION')}</option>
        </select>
        <button class="btn btn-primary btn-sm" id="add-return-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('returns.addReturn')}
        </button>
      </div>
    </div>
    <div id="returns-table-mount"></div>
    `
  );

  let allReturns = [];
  let statusFilter = '';

  const table = new DataTable({
    mount: document.getElementById('returns-table-mount'),
    pageSize: 50,
    emptyState: {
      title: t('returns.empty.title'),
      message: t('returns.empty.message'),
    },
    searchMatch: (row, term) =>
      row.orderSn.toLowerCase().includes(term) || (row.trackingNumber || '').toLowerCase().includes(term),
    columns: [
      { key: 'orderSn', label: t('returns.table.orderSn'), sortable: true, render: (r) => `<strong>${r.orderSn}</strong>` },
      { key: 'storeName', label: t('returns.table.store'), sortable: true, render: (r) => r.storeName || '<span class="text-muted">—</span>' },
      { key: 'trackingNumber', label: t('returns.table.trackingNumber'), sortable: true, render: (r) => r.trackingNumber || '<span class="text-muted">—</span>' },
      { key: 'returnType', label: t('returns.table.returnType'), sortable: true, wrap: true, render: (r) => t(`returns.types.${r.returnType}`) },
      { key: 'orderDate', label: t('returns.table.orderDate'), sortable: true, render: (r) => Formatters.formatDate(r.orderDate) },
      { key: 'daysRemaining', label: t('returns.table.daysRemaining'), sortable: true, render: (r) => renderCountdown(r.daysRemaining) },
      { key: 'status', label: t('returns.table.status'), sortable: true, render: (r) => renderStatusCell(r) },
    ],
  });

  table.onRowsRendered = () => {
    table.mount.querySelectorAll('[data-role="return-status-select"]').forEach((sel) => {
      sel.addEventListener('change', (e) => handleStatusChange(e.target.dataset.returnId, e.target.dataset.orderId, e.target.value, e.target));
    });
  };

  function renderCountdown(days) {
    let cls, text;
    if (days < 0) {
      cls = 'overdue';
      text = t('returns.countdown.overdue', { n: Math.abs(days) });
    } else if (days === 0) {
      cls = 'urgent';
      text = t('returns.countdown.lastDay');
    } else {
      cls = days <= 3 ? 'urgent' : 'safe';
      text = t('returns.countdown.daysLeft', { n: days });
    }
    return `<span class="claim-countdown ${cls}">${text}</span>`;
  }

  function renderStatusCell(r) {
    const options = Object.keys(RETURN_STATUS_BADGE_CLASS)
      .map((key) => `<option value="${key}" ${key === r.status ? 'selected' : ''}>${t(`returns.statuses.${key}`)}</option>`)
      .join('');
    return `<select class="status-select ${RETURN_STATUS_BADGE_CLASS[r.status]}" data-role="return-status-select" data-return-id="${r.id}" data-order-id="${r.orderId}">${options}</select>`;
  }

  async function handleStatusChange(returnId, orderId, newStatus, selectEl) {
    const previousStatus = allReturns.find((r) => r.id === returnId)?.status;

    const applyChange = async () => {
      try {
        await ReturnsService.resolve(returnId, orderId, newStatus);
        const row = allReturns.find((r) => r.id === returnId);
        if (row) row.status = newStatus;
        selectEl.value = newStatus;
        selectEl.className = `status-select ${RETURN_STATUS_BADGE_CLASS[newStatus]}`;
        Toast.success(t('returns.toast.statusUpdated'));
      } catch (err) {
        console.error(err);
        Toast.error(t('returns.toast.statusUpdateFailed'));
        selectEl.value = previousStatus;
      }
    };

    if (newStatus === 'GOOD_CONDITION') {
      // Revert the dropdown's visual value immediately — it only moves
      // forward once the user actually confirms in the dialog below.
      selectEl.value = previousStatus;
      ConfirmDialog.open({
        title: t('returns.confirmRestock.title'),
        message: t('returns.confirmRestock.message'),
        confirmLabel: t('returns.confirmRestock.confirmButton'),
        onConfirm: applyChange,
      });
    } else {
      await applyChange();
    }
  }

  document.getElementById('returns-search').addEventListener('input', (e) => table.setSearchTerm(e.target.value));
  document.getElementById('returns-status-filter').addEventListener('change', (e) => {
    statusFilter = e.target.value;
    applyFilter();
  });
  document.getElementById('add-return-btn').addEventListener('click', openAddReturnDrawer);

  function applyFilter() {
    const filtered = statusFilter ? allReturns.filter((r) => r.status === statusFilter) : allReturns;
    table.setData(filtered);
  }

  async function loadReturns() {
    table.showLoading();
    try {
      allReturns = await ReturnsService.getAll();
      applyFilter();
    } catch (err) {
      console.error(err);
      Toast.error(t('returns.toast.loadFailed'));
    }
  }

  // ---------- Add Return: search-as-you-type -> select -> form ----------

  function openAddReturnDrawer() {
    Drawer.open({
      title: t('returns.addDrawer.title'),
      bodyHtml: `
        <div class="field return-search-wrap">
          <label>${t('returns.addDrawer.searchLabel')}</label>
          <input class="input" id="return-order-search" placeholder="${t('returns.addDrawer.searchPlaceholder')}" autocomplete="off" />
          <div class="return-search-suggestions" id="return-search-suggestions"></div>
        </div>
        <p class="text-muted" style="font-size:12px;">${t('returns.onlyShipped')}</p>
      `,
      footerHtml: '',
    });

    const searchInput = document.getElementById('return-order-search');
    const suggestionsEl = document.getElementById('return-search-suggestions');
    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const term = e.target.value.trim();
      if (term.length < 3) {
        suggestionsEl.innerHTML = '';
        return;
      }
      debounceTimer = setTimeout(async () => {
        try {
          const results = await ReturnsService.searchEligibleOrders(term);
          renderSuggestions(results);
        } catch (err) {
          console.error(err);
        }
      }, 300);
    });

    function renderSuggestions(results) {
      if (!results.length) {
        suggestionsEl.innerHTML = `<div class="return-search-suggestion text-muted">${t('returns.addDrawer.noMatch')}</div>`;
        return;
      }
      suggestionsEl.innerHTML = results
        .map(
          (o) => `
        <div class="return-search-suggestion" data-order-id="${o.id}">
          <div class="return-search-suggestion__title">${o.order_sn}</div>
          <div class="return-search-suggestion__meta">${o.store_name ? `${o.store_name} · ` : ''}${o.tracking_number || t('returns.addDrawer.noTracking')} · ${Formatters.formatDate(o.order_date)}</div>
        </div>`
        )
        .join('');

      suggestionsEl.querySelectorAll('.return-search-suggestion[data-order-id]').forEach((el) => {
        el.addEventListener('click', () => showReturnForm(el.dataset.orderId));
      });
    }
  }

  async function showReturnForm(orderId) {
    const drawerBody = document.querySelector('[data-role="drawer-body"]');
    const drawerFooter = document.querySelector('[data-role="drawer-footer"]');
    const drawerTitle = document.querySelector('[data-role="drawer-title"]');

    drawerBody.innerHTML = `<div class="skeleton" style="height:120px;"></div>`;

    try {
      const order = await ReturnsService.getOrderDetail(orderId);
      const days = daysUntilClaimDeadline(order.order_date);

      drawerTitle.textContent = `${t('returns.addDrawer.title')} — ${order.order_sn}`;
      drawerBody.innerHTML = `
        <div class="return-order-preview">
          <div class="return-order-preview__row"><span class="text-muted">${t('returns.addDrawer.storeLabel')}</span><span>${order.store_name || '—'}</span></div>
          <div class="return-order-preview__row"><span class="text-muted">${t('returns.addDrawer.trackingNumberLabel')}</span><span>${order.tracking_number || '—'}</span></div>
          <div class="return-order-preview__row"><span class="text-muted">${t('returns.addDrawer.orderDateLabel')}</span><span>${Formatters.formatDate(order.order_date)}</span></div>
          <div class="return-order-preview__row"><span class="text-muted">${t('returns.addDrawer.claimDeadlineLabel')}</span>${renderCountdown(days)}</div>
          <div class="return-order-preview__row"><span class="text-muted">${t('returns.addDrawer.skuCountLabel')}</span><span>${order.items.length}</span></div>
        </div>
        <div class="field" style="margin-top:var(--space-2);">
          <label>${t('returns.addDrawer.returnTypeLabel')}</label>
          <select class="select" id="return-type-select">
            <option value="BUYER_RETURN">${t('returns.types.BUYER_RETURN')}</option>
            <option value="FAILED_DELIVERY">${t('returns.types.FAILED_DELIVERY')}</option>
            <option value="SHORT_SHIPMENT">${t('returns.types.SHORT_SHIPMENT')}</option>
          </select>
        </div>
        <div class="field">
          <label>${t('returns.addDrawer.notesLabel')} ${t('common.optional')}</label>
          <input class="input" id="return-notes" placeholder="${t('returns.addDrawer.notesPlaceholder')}" />
        </div>
      `;
      drawerFooter.innerHTML = `
        <button class="btn btn-secondary" data-role="cancel">${t('common.cancel')}</button>
        <button class="btn btn-primary" data-role="save">${t('common.save')}</button>
      `;
      drawerFooter.querySelector('[data-role="cancel"]').addEventListener('click', Drawer.close);
      drawerFooter.querySelector('[data-role="save"]').addEventListener('click', async () => {
        const returnType = document.getElementById('return-type-select').value;
        const notes = document.getElementById('return-notes').value;
        try {
          await ReturnsService.createReturn({ orderId, returnType, notes });
          Toast.success(t('returns.toast.saved'));
          Drawer.close();
          loadReturns();
        } catch (err) {
          console.error(err);
          Toast.error(t('returns.toast.saveFailed'));
        }
      });
    } catch (err) {
      console.error(err);
      drawerBody.innerHTML = `<p class="text-muted">${t('returns.addDrawer.detailLoadFailed')}</p>`;
    }
  }

  loadReturns();
})();

/** Days left until order_date + 30 days. Negative = past deadline. */
function daysUntilClaimDeadline(orderDate) {
  const deadline = new Date(orderDate);
  deadline.setDate(deadline.getDate() + 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.round((deadline - today) / (1000 * 60 * 60 * 24));
}
