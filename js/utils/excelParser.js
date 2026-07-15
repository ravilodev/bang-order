// ============================================================
// EXCEL PARSER — reads Shopee order export (.xlsx) and normalizes
// rows for the import pipeline. Uses SheetJS (XLSX), loaded via
// CDN in the host HTML page.
//
// Supports TWO known Shopee-adjacent export formats:
//
// FORMAT A — "packed product_info" (bulk/logistics export, e.g. the
// "Daftar Pesanan" file from shipping tools like Hemat Kargo):
//   columns: tracking_number, order_sn, order_creation_date,
//            order_list_type, return_status, buyer_user_name,
//            estimated_ship_out_date, product_info, shipping_method,
//            order_receiver_name
//   -> one row per ORDER, multiple SKUs packed into `product_info` as
//      "[1] Nama Produk:...; Nama Variasi:...; Harga: Rp X; Jumlah: Y;
//       Nomor Referensi SKU: Z; SKU Induk: W; \r\n[2] ..."
//
// FORMAT B — "flat per-SKU row" (classic Shopee Seller Center export):
//   columns: No. Pesanan, No. Resi, Waktu Pesanan Dibuat,
//            Nomor Referensi SKU, Nama Produk, Nama Variasi, Jumlah,
//            Harga Setelah Diskon
//   -> one row per SKU already.
//
// The parser auto-detects which format it's looking at from the header
// row and normalizes both into the same flat shape:
//   { order_sn, tracking_number, order_date, sku_reference,
//     product_name, variation, qty, unit_price }
// ============================================================

const FORMAT_A_HEADERS = {
  tracking_number: ['tracking_number'],
  order_sn: ['order_sn'],
  order_date: ['order_creation_date'],
  product_info: ['product_info'],
};

const FORMAT_B_HEADERS = {
  order_sn: ['No. Pesanan', 'Order ID', 'Order SN'],
  tracking_number: ['No. Resi', 'Tracking Number'],
  order_date: ['Waktu Pesanan Dibuat', 'Order Creation Date', 'Order Date'],
  sku_reference: ['Nomor Referensi SKU', 'SKU Reference No.', 'SKU'],
  product_name: ['Nama Produk', 'Product Name'],
  variation: ['Nama Variasi', 'Variation Name'],
  qty: ['Jumlah', 'Quantity'],
  unit_price: ['Harga Setelah Diskon', 'Deal Price', 'Unit Price'],
};

function findColumn(headerRow, aliases) {
  for (const alias of aliases) {
    const idx = headerRow.findIndex(
      (h) => String(h).trim().toLowerCase() === alias.toLowerCase()
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

function buildColMap(headerRow, headerSpec) {
  const colMap = {};
  for (const field in headerSpec) {
    colMap[field] = findColumn(headerRow, headerSpec[field]);
  }
  return colMap;
}

function allColumnsFound(colMap) {
  return Object.values(colMap).every((idx) => idx !== -1);
}

/**
 * Read a File object (.xlsx) and return normalized order rows.
 * Throws a descriptive error if neither known format matches.
 */
async function parseShopeeExcel(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });

  if (!rows.length) return [];

  const headerRow = rows[0];
  const dataRows = rows.slice(1).filter((r) => r && r.length);

  const colMapA = buildColMap(headerRow, FORMAT_A_HEADERS);
  if (allColumnsFound(colMapA)) {
    return parseFormatA(dataRows, colMapA);
  }

  const colMapB = buildColMap(headerRow, FORMAT_B_HEADERS);
  if (allColumnsFound(colMapB)) {
    return parseFormatB(dataRows, colMapB);
  }

  const missingA = Object.entries(colMapA).filter(([, idx]) => idx === -1).map(([f]) => f);
  throw new Error(
    `Unrecognized Excel format. Could not find required column(s): ${missingA.join(', ')}. ` +
    `Expected either a "product_info" bulk export or a classic per-SKU Shopee export.`
  );
}

// ---------- FORMAT A: packed product_info per order ----------

function parseFormatA(dataRows, colMap) {
  const normalized = [];

  for (const r of dataRows) {
    const orderSn = String(r[colMap.order_sn] || '').trim();
    const trackingNumber = String(r[colMap.tracking_number] || '').trim();
    const orderDate = normalizeDate(r[colMap.order_date]);
    const productInfoRaw = String(r[colMap.product_info] || '');

    const items = parseProductInfo(productInfoRaw);
    for (const item of items) {
      normalized.push({
        order_sn: orderSn,
        tracking_number: trackingNumber,
        order_date: orderDate,
        sku_reference: item.sku_reference,
        product_name: item.product_name,
        variation: item.variation,
        qty: item.qty,
        unit_price: item.unit_price,
      });
    }
  }

  return normalized;
}

/**
 * Parse the packed `product_info` cell into individual line items.
 * Example input:
 *   "[1] Nama Produk:Foo; Nama Variasi:; Harga: Rp 14,500; Jumlah: 1;
 *        Nomor Referensi SKU: W36; SKU Induk: W36; \r\n[2] Nama Produk:Bar; ..."
 */
function parseProductInfo(text) {
  const items = [];
  // Split on "[n] " markers — each chunk is one line item.
  const chunks = text.split(/\[\d+\]\s*/).map((c) => c.trim()).filter(Boolean);

  for (const chunk of chunks) {
    const productName = extractField(chunk, /Nama Produk\s*:\s*(.*?)\s*;/);
    const variation = extractField(chunk, /Nama Variasi\s*:\s*(.*?)\s*;/);
    const hargaRaw = extractField(chunk, /Harga\s*:\s*Rp\.?\s*([\d.,]+)/);
    const jumlahRaw = extractField(chunk, /Jumlah\s*:\s*(\d+)/);
    const skuRaw = extractField(chunk, /Nomor Referensi SKU\s*:\s*(.*?)\s*;/);

    items.push({
      product_name: productName,
      variation: variation,
      unit_price: parsePrice(hargaRaw),
      qty: Number(jumlahRaw) || 0,
      sku_reference: skuRaw,
    });
  }

  return items;
}

function extractField(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
}

// ---------- FORMAT B: classic flat per-SKU export ----------

function parseFormatB(dataRows, colMap) {
  const normalized = [];
  for (const r of dataRows) {
    normalized.push({
      order_sn: String(r[colMap.order_sn] || '').trim(),
      tracking_number: String(r[colMap.tracking_number] || '').trim(),
      order_date: normalizeDate(r[colMap.order_date]),
      sku_reference: String(r[colMap.sku_reference] || '').trim(),
      product_name: String(r[colMap.product_name] || '').trim(),
      variation: String(r[colMap.variation] || '').trim(),
      qty: Number(r[colMap.qty]) || 0,
      unit_price: parsePrice(r[colMap.unit_price]),
    });
  }
  return normalized;
}

// ---------- Shared helpers ----------

/**
 * Normalize a date value into "YYYY-MM-DD" WITHOUT going through
 * Date -> toISOString(), which would shift the date across timezone
 * boundaries (e.g. an order at "2026-07-12 00:20" WIB could roll back
 * to 2026-07-11 in UTC). We extract the date parts directly whenever
 * the source is already a recognizable "YYYY-MM-DD..." string.
 */
function normalizeDate(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a Rupiah price string into a plain number.
 * Rupiah has no decimal places, so ALL separators (comma or dot)
 * are treated as thousands separators and stripped.
 * "Rp 14,500" -> 14500 | "14.500" -> 14500
 */
function parsePrice(value) {
  if (value === undefined || value === null || value === '') return 0;
  const cleaned = String(value).replace(/Rp\.?/gi, '').replace(/[.,\s]/g, '').trim();
  return Number(cleaned) || 0;
}

window.ExcelParser = { parseShopeeExcel };
