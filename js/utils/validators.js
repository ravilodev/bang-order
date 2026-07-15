// ============================================================
// VALIDATORS — pure functions, no side effects
// ============================================================

/**
 * Validate a single normalized order row parsed from Shopee Excel.
 * Returns { valid: boolean, errors: string[] }
 */
function validateOrderRow(row) {
  const errors = [];

  if (!row.order_sn) errors.push('Missing Order SN');
  if (!row.order_date) errors.push('Missing Order Date');
  if (!row.sku_reference) errors.push('Missing SKU Reference');
  if (!row.qty || Number(row.qty) <= 0) errors.push('Invalid Quantity');
  if (row.unit_price === undefined || row.unit_price === null || Number(row.unit_price) < 0) {
    errors.push('Invalid Unit Price');
  }

  return { valid: errors.length === 0, errors };
}

/** Validate store name input */
function validateStoreName(name) {
  if (!name || !name.trim()) return 'Store name is required.';
  if (name.trim().length < 2) return 'Store name is too short.';
  return null;
}

/** Basic email format check for login */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

window.Validators = { validateOrderRow, validateStoreName, validateEmail };
