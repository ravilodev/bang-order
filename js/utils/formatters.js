// ============================================================
// FORMATTERS — presentation-only helpers, no business logic
// ============================================================

/** Format a number as IDR currency, e.g. 125000 -> "Rp125.000" */
function formatCurrency(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

/** Format a plain number with thousands separators */
function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0);
}

/** Format ISO date string -> "14 Jul 2026" */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format ISO date string -> "2026-07-14" (for grouping/keys) */
function toDateKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Truncate long text with ellipsis */
function truncate(text, max = 28) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** Human file size, e.g. 128000 -> "125 KB" */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

window.Formatters = { formatCurrency, formatNumber, formatDate, toDateKey, truncate, formatFileSize };
