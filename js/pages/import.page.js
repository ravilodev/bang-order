// ============================================================
// IMPORT PAGE CONTROLLER
// ============================================================

(async function initImport() {
  await AuthService.requireSession();
  const content = await Shell.render({
    active: 'import',
    titleKey: 'import.title',
    subtitleKey: 'import.subtitle',
  });

  let selectedFile = null;
  const stores = await StoreService.getActiveStores();

  content.insertAdjacentHTML(
    'beforeend',
    `
    <div class="import-layout">
      <div>
        <div class="field" style="margin-bottom:var(--space-2); max-width:320px;">
          <label>${t('import.storeLabel')}</label>
          <select class="select" id="import-store-select">
            <option value="">${t('import.selectStorePlaceholder')}</option>
            ${stores.map((s) => `<option value="${s.id}">${s.store_name}</option>`).join('')}
          </select>
        </div>

        ${
          stores.length === 0
            ? `<div class="empty-state" style="background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M5 21V7l8-4v18M13 21V11l6 4v6"/></svg>
                <h3>${t('import.noStoreTitle')}</h3>
                <p>${t('import.noStoreMessage')}</p>
                <a class="btn btn-primary btn-sm" href="/pages/settings.html">${t('import.goToSettings')}</a>
              </div>`
            : `
            <div class="upload-box" id="upload-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <h3>${t('import.uploadTitle')}</h3>
              <p>${t('import.uploadSubtitle')}</p>
              <input type="file" id="file-input" accept=".xlsx" />
            </div>
            <div id="file-chip-mount"></div>
            <div class="import-actions">
              <button class="btn btn-primary" id="import-btn" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                ${t('import.importButton')}
              </button>
            </div>
          `
        }
      </div>

      <div class="import-sidebar">
        <div class="card">
          <h3>${t('import.beforeImportTitle')}</h3>
          <div class="import-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>${t('import.noteText')}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: var(--space-3);">
      <h3 style="margin-bottom: var(--space-2);">${t('import.history.title')}</h3>
      <div id="history-table-mount">
        <div class="empty-state" style="padding: var(--space-3) 0;">
          <p>${t('import.history.selectStore')}</p>
        </div>
      </div>
    </div>
    `
  );

  if (stores.length === 0) return;

  const uploadBox = document.getElementById('upload-box');
  const fileInput = document.getElementById('file-input');
  const fileChipMount = document.getElementById('file-chip-mount');
  const importBtn = document.getElementById('import-btn');
  const storeSelect = document.getElementById('import-store-select');

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
    fileChipMount.innerHTML = `
      <div class="file-chip">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="file-chip__name">${file.name}</span>
        <span class="file-chip__size">${Formatters.formatFileSize(file.size)}</span>
        <span class="file-chip__remove" id="remove-file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </span>
      </div>`;
    document.getElementById('remove-file').addEventListener('click', () => {
      selectedFile = null;
      fileChipMount.innerHTML = '';
      fileInput.value = '';
      updateImportBtn();
    });
    updateImportBtn();
  }

  function updateImportBtn() {
    importBtn.disabled = !(selectedFile && storeSelect.value);
  }
  storeSelect.addEventListener('change', () => {
    updateImportBtn();
    loadHistory();
  });

  async function loadHistory() {
    const mount = document.getElementById('history-table-mount');
    const storeId = storeSelect.value;

    if (!storeId) {
      mount.innerHTML = `<div class="empty-state" style="padding: var(--space-3) 0;"><p>${t('import.history.selectStore')}</p></div>`;
      return;
    }

    mount.innerHTML = `<div class="skeleton" style="height: 40px;"></div>`;

    try {
      const history = await ImportBatchService.getHistory(storeId);
      renderHistoryTable(history);
    } catch (err) {
      console.error(err);
      mount.innerHTML = `<div class="empty-state" style="padding: var(--space-3) 0;"><p>${t('import.history.loadFailed')}</p></div>`;
    }
  }

  function renderHistoryTable(history) {
    const mount = document.getElementById('history-table-mount');

    if (!history.length) {
      mount.innerHTML = `
        <div class="empty-state" style="padding: var(--space-3) 0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <h3>${t('import.history.emptyTitle')}</h3>
          <p>${t('import.history.emptyMessage')}</p>
        </div>`;
      return;
    }

    mount.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>${t('import.history.date')}</th>
              <th>${t('import.history.lastFile')}</th>
              <th style="text-align:right;">${t('import.history.printed')}</th>
              <th style="text-align:right;">${t('import.history.cancelled')}</th>
              <th style="text-align:right;">${t('import.history.handedToCourier')}</th>
            </tr>
          </thead>
          <tbody>
            ${history
              .map(
                (h) => `
              <tr>
                <td>${Formatters.formatDate(h.uploadDate)}</td>
                <td class="wrap text-secondary">${h.fileName || '—'}</td>
                <td class="num">${Formatters.formatNumber(h.printed)}</td>
                <td class="num">${h.cancelled > 0 ? `<span style="color:var(--color-danger); font-weight:600;">${Formatters.formatNumber(h.cancelled)}</span>` : '0'}</td>
                <td class="num"><strong>${Formatters.formatNumber(h.handedToCourier)}</strong></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  importBtn.addEventListener('click', runImport);

  async function runImport() {
    const storeId = storeSelect.value;
    if (!storeId || !selectedFile) return;

    importBtn.disabled = true;
    const stepper = ProgressStepper.open([
      t('import.steps.readingExcel'),
      t('import.steps.validatingData'),
      t('import.steps.checkingDuplicate'),
      t('import.steps.savingDatabase'),
      t('import.steps.refreshingDashboard'),
    ]);

    try {
      // Step 1: Read Excel
      stepper.setActive(0);
      const parsedRows = await ExcelParser.parseShopeeExcel(selectedFile);
      stepper.setDone(0);

      // Step 2: Validate
      stepper.setActive(1);
      const validRows = [];
      const invalidCount = { count: 0 };
      for (const row of parsedRows) {
        const result = Validators.validateOrderRow(row);
        if (result.valid) validRows.push(row);
        else invalidCount.count++;
      }
      await sleep(300);
      stepper.setDone(1);

      // Step 3: Duplicate check
      stepper.setActive(2);
      const existingSns = await OrderService.getExistingOrderSns(storeId);
      const { newRows, duplicateRows } = Dedupe.splitNewAndDuplicate(validRows, existingSns);
      await sleep(300);
      stepper.setDone(2);

      // Step 4: Save
      stepper.setActive(3);
      let result = { ordersCreated: 0, itemsCreated: 0 };
      if (newRows.length) {
        result = await ImportService.saveRows(storeId, newRows, selectedFile.name);
      }
      stepper.setDone(3);

      // Step 5: Refresh
      stepper.setActive(4);
      await loadHistory();
      stepper.setDone(4);

      stepper.setFootnote(t('import.steps.complete'));
      setTimeout(() => stepper.close(), 500);

      Toast.success(
        t('import.toast.imported', { orders: result.ordersCreated, duplicates: duplicateRows.length, invalid: invalidCount.count })
      );

      if (result.skippedSkus && result.skippedSkus.length) {
        Toast.info(
          t('import.toast.skippedSkus', {
            n: result.skippedSkus.length,
            list: result.skippedSkus.slice(0, 5).join(', ') + (result.skippedSkus.length > 5 ? ', ...' : ''),
          })
        );
      }

      // These are secondary steps — if either failed, the orders above
      // were still saved successfully. Say so honestly rather than
      // letting the success toast imply everything went through.
      if (result.batchRecordFailed) Toast.error(t('import.toast.batchRecordFailed'));
      if (result.inventoryDeductFailed) Toast.error(t('import.toast.inventoryDeductFailed'));

      // Reset form
      selectedFile = null;
      fileChipMount.innerHTML = '';
      fileInput.value = '';
      updateImportBtn();
    } catch (err) {
      console.error(err);
      stepper.close();
      Toast.error(err.message || t('import.toast.failed'));
      importBtn.disabled = false;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
