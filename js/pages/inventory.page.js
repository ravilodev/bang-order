// ============================================================
// INVENTORY PAGE CONTROLLER
// ============================================================

function movementLabel(type) {
  return t(`inventory.movements.${type}`);
}

(async function initInventory() {
  await AuthService.requireSession();
  const content = await Shell.render({
    active: 'inventory',
    titleKey: 'inventory.title',
    subtitleKey: 'inventory.subtitle',
  });

  content.insertAdjacentHTML(
    'beforeend',
    `
    <div id="low-stock-banner"></div>

    <div class="table-toolbar">
      <div class="input-icon-wrap table-toolbar__search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="input" id="inventory-search" placeholder="${t('inventory.searchPlaceholder')}" />
      </div>
      <div class="table-toolbar__filters">
        <button class="btn btn-secondary btn-sm" id="refresh-inventory-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          ${t('common.refresh')}
        </button>
        <button class="btn btn-secondary btn-sm" id="bulk-upload-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          ${t('inventory.uploadFromShopee')}
        </button>
        <button class="btn btn-primary btn-sm" id="add-sku-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${t('inventory.addSku')}
        </button>
      </div>
    </div>
    <div id="inventory-table-mount"></div>
    `
  );

  let allSkus = [];

  const table = new DataTable({
    mount: document.getElementById('inventory-table-mount'),
    pageSize: 50,
    emptyState: {
      title: t('inventory.empty.title'),
      message: t('inventory.empty.message'),
    },
    searchMatch: (row, term) =>
      row.sku_reference.toLowerCase().includes(term) ||
      (row.product_name || '').toLowerCase().includes(term),
    columns: [
      {
        key: 'sku_reference',
        label: t('inventory.table.skuReference'),
        sortable: true,
        render: (r) => `
          <div style="display:flex; align-items:center; gap:8px;">
            ${r.image_url
              ? `<img src="${r.image_url}" alt="" style="width:28px; height:28px; border-radius:6px; object-fit:cover; flex-shrink:0; background:var(--color-bg);" onerror="this.style.display='none'" />`
              : ''}
            <strong>${r.sku_reference}</strong>
          </div>`,
      },
      { key: 'product_name', label: t('inventory.table.productName'), sortable: true, wrap: true, render: (r) => r.product_name || '<span class="text-muted">—</span>' },
      { key: 'current_stock', label: t('inventory.table.currentStock'), sortable: true, align: 'right', render: (r) => Formatters.formatNumber(r.current_stock) },
      { key: 'low_stock_threshold', label: t('inventory.table.threshold'), sortable: true, align: 'right', render: (r) => Formatters.formatNumber(r.low_stock_threshold) },
      {
        key: 'health',
        label: t('inventory.table.status'),
        sortable: false,
        render: (r) => (r.current_stock <= r.low_stock_threshold
          ? `<span class="badge badge-cancelled">${t('inventory.badges.lowStock')}</span>`
          : `<span class="badge badge-shipped">${t('inventory.badges.ok')}</span>`),
      },
      {
        key: 'actions',
        label: '',
        sortable: false,
        render: (r) => `
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" data-action="adjust" data-sku="${r.sku_reference}">${t('inventory.actions.adjust')}</button>
            <button class="btn btn-ghost btn-sm" data-action="history" data-sku="${r.sku_reference}">${t('inventory.actions.history')}</button>
            <button class="btn btn-ghost btn-sm" data-action="edit" data-sku="${r.sku_reference}">${t('inventory.actions.edit')}</button>
          </div>`,
      },
    ],
  });

  table.onRowsRendered = () => {
    table.mount.querySelectorAll('[data-action="adjust"]').forEach((btn) => {
      btn.addEventListener('click', () => openAdjustDrawer(btn.dataset.sku));
    });
    table.mount.querySelectorAll('[data-action="history"]').forEach((btn) => {
      btn.addEventListener('click', () => openHistoryDrawer(btn.dataset.sku));
    });
    table.mount.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => openEditDrawer(btn.dataset.sku));
    });
  };

  document.getElementById('inventory-search').addEventListener('input', (e) => table.setSearchTerm(e.target.value));
  document.getElementById('refresh-inventory-btn').addEventListener('click', loadInventory);
  document.getElementById('add-sku-btn').addEventListener('click', openAddDrawer);
  document.getElementById('bulk-upload-btn').addEventListener('click', openBulkUploadDrawer);

  async function loadInventory() {
    table.showLoading();
    try {
      allSkus = await InventoryService.getAll();
      table.setData(allSkus);
      renderLowStockBanner();
    } catch (err) {
      console.error(err);
      Toast.error(t('inventory.toast.loadFailed'));
    }
  }

  function renderLowStockBanner() {
    const banner = document.getElementById('low-stock-banner');
    const lowStock = allSkus.filter((s) => s.current_stock <= s.low_stock_threshold);
    if (!lowStock.length) {
      banner.innerHTML = '';
      return;
    }
    banner.innerHTML = `
      <div class="import-note" style="background: var(--color-danger-soft); margin-bottom: var(--space-2);">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>${t('inventory.lowStockBanner', { n: lowStock.length, list: lowStock.map((s) => s.sku_reference).slice(0, 8).join(', ') + (lowStock.length > 8 ? ', ...' : '') })}</span>
      </div>`;
  }

  function openAddDrawer() {
    Drawer.open({
      title: t('inventory.addDrawer.title'),
      bodyHtml: `
        <div class="field">
          <label>${t('inventory.addDrawer.skuReference')}</label>
          <input class="input" id="new-sku-ref" placeholder="${t('inventory.addDrawer.skuPlaceholder')}" />
        </div>
        <div class="field">
          <label>${t('inventory.addDrawer.productName')} ${t('common.optional')}</label>
          <input class="input" id="new-sku-name" placeholder="${t('inventory.addDrawer.productNamePlaceholder')}" />
        </div>
        <div class="field">
          <label>${t('inventory.addDrawer.imageUrl')} ${t('common.optional')}</label>
          <input class="input" id="new-sku-image" placeholder="${t('inventory.addDrawer.imageUrlPlaceholder')}" />
        </div>
        <div class="field">
          <label>${t('inventory.addDrawer.initialStock')}</label>
          <input class="input" type="number" id="new-sku-stock" value="0" min="0" />
        </div>
        <div class="field">
          <label>${t('inventory.addDrawer.threshold')}</label>
          <input class="input" type="number" id="new-sku-threshold" value="5" min="0" />
        </div>
        <span class="text-muted" id="new-sku-error" style="font-size:12px;"></span>
      `,
      footerHtml: `
        <button class="btn btn-secondary" data-role="cancel">${t('common.cancel')}</button>
        <button class="btn btn-primary" data-role="save">${t('common.save')}</button>
      `,
    });
    document.querySelector('.drawer [data-role="cancel"]').addEventListener('click', Drawer.close);
    document.querySelector('.drawer [data-role="save"]').addEventListener('click', async () => {
      const skuRef = document.getElementById('new-sku-ref').value.trim();
      const productName = document.getElementById('new-sku-name').value;
      const imageUrl = document.getElementById('new-sku-image').value;
      const initialStock = Number(document.getElementById('new-sku-stock').value) || 0;
      const threshold = Number(document.getElementById('new-sku-threshold').value) || 0;

      if (!skuRef) {
        document.getElementById('new-sku-error').textContent = t('inventory.addDrawer.skuRequired');
        return;
      }
      if (allSkus.some((s) => s.sku_reference.toLowerCase() === skuRef.toLowerCase())) {
        document.getElementById('new-sku-error').textContent = t('inventory.addDrawer.skuExists');
        return;
      }

      try {
        await InventoryService.registerSku({
          skuReference: skuRef,
          productName,
          imageUrl,
          initialStock,
          lowStockThreshold: threshold,
        });
        Toast.success(t('inventory.toast.skuAdded'));
        Drawer.close();
        loadInventory();
      } catch (err) {
        console.error(err);
        Toast.error(t('inventory.toast.skuAddFailed'));
      }
    });
  }

  function openBulkUploadDrawer() {
    let selectedFile = null;

    Drawer.open({
      title: t('inventory.bulkUploadDrawer.title'),
      bodyHtml: `
        <p class="text-secondary" style="font-size:13.5px;">
          ${t('inventory.bulkUploadDrawer.description')}
        </p>
        <div class="upload-box" id="inv-upload-box" style="padding: var(--space-4) var(--space-2);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <h3 style="font-size:14px;">${t('inventory.bulkUploadDrawer.dropText')}</h3>
          <p>${t('inventory.bulkUploadDrawer.browseText')}</p>
          <input type="file" id="inv-file-input" accept=".xlsx" />
        </div>
        <div id="inv-file-chip-mount"></div>
        <span class="text-muted" id="bulk-upload-error" style="font-size:12px;"></span>
      `,
      footerHtml: `
        <button class="btn btn-secondary" data-role="cancel">${t('common.cancel')}</button>
        <button class="btn btn-primary" data-role="save" disabled>${t('inventory.bulkUploadDrawer.uploadButton')}</button>
      `,
    });

    const uploadBox = document.getElementById('inv-upload-box');
    const fileInput = document.getElementById('inv-file-input');
    const chipMount = document.getElementById('inv-file-chip-mount');
    const uploadBtn = document.querySelector('.drawer [data-role="save"]');

    uploadBox.addEventListener('click', () => fileInput.click());
    uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('drag-over'); });
    uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('drag-over'));
    uploadBox.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadBox.classList.remove('drag-over');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
      if (!file.name.endsWith('.xlsx')) {
        Toast.error(t('import.toast.onlyXlsx'));
        return;
      }
      selectedFile = file;
      chipMount.innerHTML = `
        <div class="file-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span class="file-chip__name">${file.name}</span>
          <span class="file-chip__size">${Formatters.formatFileSize(file.size)}</span>
        </div>`;
      uploadBtn.disabled = false;
    }

    document.querySelector('.drawer [data-role="cancel"]').addEventListener('click', Drawer.close);
    uploadBtn.addEventListener('click', async () => {
      if (!selectedFile) return;
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<span class="spinner"></span>';

      try {
        const rows = await InventoryExcelParser.parseInventoryExcel(selectedFile);
        if (!rows.length) {
          document.getElementById('bulk-upload-error').textContent = t('inventory.bulkUploadDrawer.noRowsFound');
          uploadBtn.disabled = false;
          uploadBtn.textContent = t('inventory.bulkUploadDrawer.uploadButton');
          return;
        }
        const { created, updated } = await InventoryService.bulkUpsertFromFile(rows);
        Toast.success(t('inventory.toast.bulkResult', { created, updated }));
        Drawer.close();
        loadInventory();
      } catch (err) {
        console.error(err);
        document.getElementById('bulk-upload-error').textContent = err.message || t('inventory.bulkUploadDrawer.processFailed');
        uploadBtn.disabled = false;
        uploadBtn.textContent = t('inventory.bulkUploadDrawer.uploadButton');
      }
    });
  }

  function openEditDrawer(skuRef) {
    const sku = allSkus.find((s) => s.sku_reference === skuRef);
    if (!sku) return;

    Drawer.open({
      title: t('inventory.editDrawer.title', { sku: skuRef }),
      bodyHtml: `
        <div class="field">
          <label>${t('inventory.editDrawer.productName')}</label>
          <input class="input" id="edit-sku-name" value="${sku.product_name || ''}" />
        </div>
        <div class="field">
          <label>${t('inventory.editDrawer.imageUrl')}</label>
          <input class="input" id="edit-sku-image" value="${sku.image_url || ''}" placeholder="${t('inventory.addDrawer.imageUrlPlaceholder')}" />
          <div id="edit-sku-image-preview" style="margin-top:8px;">
            ${sku.image_url ? `<img src="${sku.image_url}" alt="" style="width:64px; height:64px; border-radius:8px; object-fit:cover; border:1px solid var(--color-border);" onerror="this.style.display='none'" />` : ''}
          </div>
        </div>
        <div class="field">
          <label>${t('inventory.editDrawer.threshold')}</label>
          <input class="input" type="number" id="edit-sku-threshold" value="${sku.low_stock_threshold}" min="0" />
        </div>
        <p class="text-muted" style="font-size:12px;">${t('inventory.editDrawer.note')}</p>
      `,
      footerHtml: `
        <button class="btn btn-secondary" data-role="cancel">${t('common.cancel')}</button>
        <button class="btn btn-primary" data-role="save">${t('common.save')}</button>
      `,
    });

    document.getElementById('edit-sku-image').addEventListener('input', (e) => {
      const preview = document.getElementById('edit-sku-image-preview');
      const url = e.target.value.trim();
      preview.innerHTML = url
        ? `<img src="${url}" alt="" style="width:64px; height:64px; border-radius:8px; object-fit:cover; border:1px solid var(--color-border);" onerror="this.style.display='none'" />`
        : '';
    });

    document.querySelector('.drawer [data-role="cancel"]').addEventListener('click', Drawer.close);
    document.querySelector('.drawer [data-role="save"]').addEventListener('click', async () => {
      const productName = document.getElementById('edit-sku-name').value;
      const imageUrl = document.getElementById('edit-sku-image').value;
      const threshold = Number(document.getElementById('edit-sku-threshold').value) || 0;
      try {
        await InventoryService.updateSkuInfo(skuRef, { productName, imageUrl, lowStockThreshold: threshold });
        Toast.success(t('inventory.toast.skuUpdated'));
        Drawer.close();
        loadInventory();
      } catch (err) {
        console.error(err);
        Toast.error(t('inventory.toast.skuUpdateFailed'));
      }
    });
  }

  function openAdjustDrawer(skuRef) {
    const sku = allSkus.find((s) => s.sku_reference === skuRef);
    if (!sku) return;

    Drawer.open({
      title: t('inventory.adjustDrawer.title', { sku: skuRef }),
      bodyHtml: `
        <p class="text-secondary" style="font-size:13.5px;">${t('inventory.adjustDrawer.currentStock')}: <strong>${Formatters.formatNumber(sku.current_stock)}</strong></p>
        <div class="field">
          <label>${t('inventory.adjustDrawer.qtyChange')}</label>
          <input class="input" type="number" id="adjust-qty" placeholder="e.g. 50 or -3" />
          <span class="text-muted" style="font-size:12px;">${t('inventory.adjustDrawer.qtyHint')}</span>
        </div>
        <div class="field">
          <label>${t('inventory.adjustDrawer.note')} ${t('common.optional')}</label>
          <input class="input" id="adjust-note" placeholder="${t('inventory.adjustDrawer.notePlaceholder')}" />
        </div>
        <span class="text-muted" id="adjust-error" style="font-size:12px;"></span>
      `,
      footerHtml: `
        <button class="btn btn-secondary" data-role="cancel">${t('common.cancel')}</button>
        <button class="btn btn-primary" data-role="save">${t('inventory.adjustDrawer.applyButton')}</button>
      `,
    });
    document.querySelector('.drawer [data-role="cancel"]').addEventListener('click', Drawer.close);
    document.querySelector('.drawer [data-role="save"]').addEventListener('click', async () => {
      const qtyChange = Number(document.getElementById('adjust-qty').value);
      const note = document.getElementById('adjust-note').value;

      if (!qtyChange) {
        document.getElementById('adjust-error').textContent = t('inventory.adjustDrawer.qtyRequired');
        return;
      }

      try {
        await InventoryService.adjustStock(skuRef, qtyChange, note);
        Toast.success(t('inventory.toast.stockAdjusted'));
        Drawer.close();
        loadInventory();
      } catch (err) {
        console.error(err);
        Toast.error(t('inventory.toast.stockAdjustFailed'));
      }
    });
  }

  async function openHistoryDrawer(skuRef) {
    Drawer.open({
      title: t('inventory.historyDrawer.title', { sku: skuRef }),
      bodyHtml: `<div id="history-mount"><div class="skeleton" style="height:120px;"></div></div>`,
    });

    try {
      const movements = await InventoryService.getMovementHistory(skuRef);
      const mount = document.getElementById('history-mount');
      if (!movements.length) {
        mount.innerHTML = `<p class="text-muted" style="font-size:13.5px;">${t('inventory.historyDrawer.empty')}</p>`;
        return;
      }
      mount.innerHTML = movements
        .map((m) => {
          const isPositive = m.qty_change > 0;
          const label = movementLabel(m.movement_type);
          return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--color-border);">
            <div>
              <div style="font-weight:500; font-size:13.5px;">${label}${m.orders ? ` · <span class="text-muted">${m.orders.order_sn}</span>` : ''}</div>
              <div class="text-muted" style="font-size:12px;">${new Date(m.created_at).toLocaleString('en-GB')}${m.note ? ` · ${m.note}` : ''}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:600; color:${isPositive ? 'var(--color-success)' : 'var(--color-danger)'};">${isPositive ? '+' : ''}${m.qty_change}</div>
              <div class="text-muted" style="font-size:12px;">→ ${m.resulting_stock}</div>
            </div>
          </div>`;
        })
        .join('');
    } catch (err) {
      console.error(err);
      document.getElementById('history-mount').innerHTML = `<p class="text-muted">${t('inventory.historyDrawer.loadFailed')}</p>`;
    }
  }

  loadInventory();
})();
