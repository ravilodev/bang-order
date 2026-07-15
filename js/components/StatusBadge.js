// ============================================================
// STATUS BADGE — renders read-only badge HTML for a given status
// ============================================================

const STATUS_META = {
  PENDING:   { label: 'Pending',   badgeClass: 'badge-pending',   selectClass: 'st-pending' },
  SHIPPED:   { label: 'Shipped',   badgeClass: 'badge-shipped',   selectClass: 'st-shipped' },
  CANCELLED: { label: 'Cancelled', badgeClass: 'badge-cancelled', selectClass: 'st-cancelled' },
  REPLACE:   { label: 'Replace',   badgeClass: 'badge-replace',   selectClass: 'st-replace' },
};

const StatusBadge = {
  /** Static, read-only badge (e.g. for legends) */
  render(status) {
    const meta = STATUS_META[status] || STATUS_META.PENDING;
    return `<span class="badge ${meta.badgeClass}">${meta.label}</span>`;
  },

  /**
   * Interactive inline <select> used in the Orders table so status can
   * change instantly without a page reload.
   */
  renderSelect(status, orderId) {
    const meta = STATUS_META[status] || STATUS_META.PENDING;
    const options = Object.keys(STATUS_META)
      .map((key) => `<option value="${key}" ${key === status ? 'selected' : ''}>${STATUS_META[key].label}</option>`)
      .join('');
    return `<select class="status-select ${meta.selectClass}" data-order-id="${orderId}" data-role="status-select">${options}</select>`;
  },

  meta(status) {
    return STATUS_META[status] || STATUS_META.PENDING;
  },
};

window.StatusBadge = StatusBadge;
window.STATUS_META = STATUS_META;
