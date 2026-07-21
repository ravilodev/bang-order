// ============================================================
// INVENTORY EXCEL PARSER — reads Shopee's official "Mass Update
// Sales Info" bulk-edit template (Produk > Stok > bulk export/edit)
// and extracts just what Bang Order's Inventory needs: SKU + stock.
//
// This template is NOT a plain data export — it's Shopee's own bulk
// EDIT form, so it ships with system metadata rows and instruction
// text above the real header row, and its position can shift slightly
// between exports. The header row is therefore located by CONTENT
// (looking for the exact column names) rather than a fixed row index.
//
// Column quirks this parser accounts for:
//   - There are TWO sku columns: "SKU Induk" (parent/product-level)
//     and "SKU" (variation-level). Orders reference the VARIATION-
//     level SKU, so that's what we use — "SKU Induk" is only a
//     fallback for single-variation products where Shopee leaves the
//     "SKU" cell blank and only fills "SKU Induk".
//   - "SKU Induk" is only populated on the FIRST row of a multi-
//     variation product group, not every row — irrelevant to us since
//     we prefer "SKU" whenever it's present anyway.
//   - Price ("Harga") is intentionally ignored — Bang Order's
//     Inventory tracks quantity only; price lives in Orders.
// ============================================================

const REQUIRED_HEADERS = ['Nama Produk', 'SKU Induk', 'SKU', 'Stok'];

/**
 * Read a File object (.xlsx) and return normalized rows:
 *   [{ sku_reference, product_name, stock }]
 */
async function parseInventoryExcel(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });

  if (!rows.length) return [];

  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx === -1) {
    throw new Error(t('inventory.bulkUploadDrawer.unrecognizedFile', { cols: REQUIRED_HEADERS.join(', ') }));
  }

  const headerRow = rows[headerIdx].map((h) => String(h || '').trim());
  const colIdx = {
    namaProduk: headerRow.indexOf('Nama Produk'),
    skuInduk: headerRow.indexOf('SKU Induk'),
    sku: headerRow.indexOf('SKU'),
    stok: headerRow.indexOf('Stok'),
  };

  const normalized = [];
  const bySku = {}; // last-write-wins if a SKU appears more than once in the file

  for (const row of rows.slice(headerIdx + 1)) {
    if (!row || !row.length) continue;

    // Data rows are identified by having a numeric "Stok" value — this
    // naturally skips the "Wajib" marker row, the blank spacer row, and
    // the long instruction-text row that all sit between the header
    // and the real data in Shopee's template.
    const stokRaw = row[colIdx.stok];
    const stock = Number(stokRaw);
    if (stokRaw === undefined || stokRaw === '' || isNaN(stock)) continue;

    const skuVariant = String(row[colIdx.sku] || '').trim();
    const skuParent = String(row[colIdx.skuInduk] || '').trim();
    const skuReference = skuVariant || skuParent;
    if (!skuReference) continue; // no usable SKU identifier on this row

    const productName = String(row[colIdx.namaProduk] || '').trim();

    bySku[skuReference] = { sku_reference: skuReference, product_name: productName, stock };
  }

  for (const sku in bySku) normalized.push(bySku[sku]);
  return normalized;
}

/** Scan the first ~15 rows for the one containing all required headers. */
function findHeaderRowIndex(rows) {
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] || []).map((c) => String(c || '').trim());
    if (REQUIRED_HEADERS.every((h) => cells.includes(h))) return i;
  }
  return -1;
}

window.InventoryExcelParser = { parseInventoryExcel };
