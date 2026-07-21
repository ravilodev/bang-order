// ============================================================
// STATUS BADGE — renders read-only badge HTML for a given status
// ============================================================

const STATUS_META = {
  PENDING:   { badgeClass: 'badge-pending',   selectClass: 'st-pending' },
  SHIPPED:   { badgeClass: 'badge-shipped',   selectClass: 'st-shipped' },
  CANCELLED: { badgeClass: 'badge-cancelled', selectClass: 'st-cancelled' },
  REPLACE:   { badgeClass: 'badge-replace',   selectClass: 'st-replace' },
  RETURNED:  { badgeClass: 'badge-returned',  selectClass: 'st-returned' },
};

// RETURNED is deliberately excluded — it's only ever set by the
// Returns workflow (js/services/returns.service.js), never by hand,
// so every Returned order always has a corresponding return record
// explaining why. Manually selectable statuses stay as before.
const MANUALLY_SELECTABLE_STATUSES = ['PENDING', 'SHIPPED', 'CANCELLED', 'REPLACE'];

const StatusBadge = {
  /** Static, read-only badge (e.g. for legends, or Returned orders) */
  render(status) {
    const meta = STATUS_META[status] || STATUS_META.PENDING;
    return `<span class="badge ${meta.badgeClass}">${t(`statusBadge.${status}`)}</span>`;
  },

  /**
   * Interactive inline <select> used in the Orders table so status can
   * change instantly without a page reload. Only offers the manually
   * selectable statuses — callers should render a read-only badge()
   * instead when the current status is RETURNED.
   */
  renderSelect(status, orderId) {
    const meta = STATUS_META[status] || STATUS_META.PENDING;
    const options = MANUALLY_SELECTABLE_STATUSES
      .map((key) => `<option value="${key}" ${key === status ? 'selected' : ''}>${t(`statusBadge.${key}`)}</option>`)
      .join('');
    return `<select class="status-select ${meta.selectClass}" data-order-id="${orderId}" data-role="status-select">${options}</select>`;
  },

  meta(status) {
    return STATUS_META[status] || STATUS_META.PENDING;
  },
};

window.StatusBadge = StatusBadge;
window.STATUS_META = STATUS_META;
