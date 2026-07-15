// ============================================================
// IMPORT PAGE CONTROLLER
// ============================================================

(async function initImport() {
  await AuthService.requireSession();
  const content = await Shell.render({
    active: 'import',
    title: 'Import Orders',
    subtitle: 'Upload a Shopee order export to recap and validate fulfillment',
  });

  let selectedFile = null;
  const stores = await StoreService.getActiveStores();

  content.insertAdjacentHTML(
    'beforeend',
    `
    <div class="import-layout">
      <div>
        <div class="field" style="margin-bottom:var(--space-2); max-width:320px;">
          <label>Store</label>
          <select class="select" id="import-store-select">
            <option value="">Select a store...</option>
            ${stores.map((s) => `<option value="${s.id}">${s.store_name}</option>`).join('')}
          </select>
        </div>

        ${
          stores.length === 0
            ? `<div class="empty-state" style="background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M5 21V7l8-4v18M13 21V11l6 4v6"/></svg>
                <h3>No store available.</h3>
                <p>Please create a store first.</p>
                <a class="btn btn-primary btn-sm" href="/pages/settings.html">Go to Settings</a>
              </div>`
            : `
            <div class="upload-box" id="upload-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <h3>Drop your Shopee Excel file here</h3>
              <p>or click to browse — .xlsx files only</p>
              <input type="file" id="file-input" accept=".xlsx" />
            </div>
            <div id="file-chip-mount"></div>
            <div class="import-actions">
              <button class="btn btn-primary" id="import-btn" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import
              </button>
            </div>
          `
        }
      </div>

      <div class="import-sidebar">
        <div class="card">
          <h3>Before you import</h3>
          <div class="import-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>Make sure the store is selected before uploading. Duplicate order numbers are automatically skipped.</span>
          </div>
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
      Toast.error('Only .xlsx files are supported.');
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
  storeSelect.addEventListener('change', updateImportBtn);

  importBtn.addEventListener('click', runImport);

  async function runImport() {
    const storeId = storeSelect.value;
    if (!storeId || !selectedFile) return;

    importBtn.disabled = true;
    const stepper = ProgressStepper.open([
      'Reading Excel',
      'Validating Data',
      'Checking Duplicate',
      'Saving Database',
      'Refreshing Dashboard',
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
        result = await ImportService.saveRows(storeId, newRows);
      }
      stepper.setDone(3);

      // Step 5: Refresh
      stepper.setActive(4);
      await sleep(400);
      stepper.setDone(4);

      stepper.setFootnote('Import complete.');
      setTimeout(() => stepper.close(), 500);

      Toast.success(
        `Imported ${result.ordersCreated} orders (${duplicateRows.length} duplicates skipped, ${invalidCount.count} invalid rows ignored).`
      );

      // Reset form
      selectedFile = null;
      fileChipMount.innerHTML = '';
      fileInput.value = '';
      updateImportBtn();
    } catch (err) {
      console.error(err);
      stepper.close();
      Toast.error(err.message || 'Import failed. Please check the file format.');
      importBtn.disabled = false;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
