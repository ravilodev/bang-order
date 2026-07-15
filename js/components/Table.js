// ============================================================
// DATA TABLE — reusable across Orders page (and anywhere else a
// searchable/sortable/paginated table is needed).
// Consumers supply column definitions with a `render(row)` function,
// so cell markup (badges, selects, inputs) stays flexible.
// ============================================================

class DataTable {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.mount - container element
   * @param {Array} opts.columns - [{ key, label, sortable, align, render(row) }]
   * @param {number} opts.pageSize
   * @param {Function} opts.searchMatch - (row, term) => boolean
   * @param {Object} opts.emptyState - { icon, title, message }
   */
  constructor({ mount, columns, pageSize = 10, searchMatch, emptyState }) {
    this.mount = mount;
    this.columns = columns;
    this.pageSize = pageSize;
    this.searchMatch = searchMatch || (() => true);
    this.emptyState = emptyState || { title: 'No data', message: 'Nothing to show yet.' };

    this.rows = [];
    this.searchTerm = '';
    this.sortKey = null;
    this.sortDir = 'asc';
    this.page = 1;

    this._buildShell();
  }

  _buildShell() {
    this.mount.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr></tr></thead>
          <tbody></tbody>
        </table>
        <div class="table-pagination">
          <span class="table-pagination__info"></span>
          <div class="table-pagination__controls"></div>
        </div>
      </div>
    `;
    this.theadRow = this.mount.querySelector('thead tr');
    this.tbody = this.mount.querySelector('tbody');
    this.paginationInfo = this.mount.querySelector('.table-pagination__info');
    this.paginationControls = this.mount.querySelector('.table-pagination__controls');
    this._renderHeader();
  }

  _renderHeader() {
    this.theadRow.innerHTML = this.columns
      .map((col) => {
        const sortIcon = col.sortable
          ? `<svg class="sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10l5-5 5 5M7 14l5 5 5-5"/></svg>`
          : '';
        return `<th data-key="${col.key}" style="${col.align === 'right' ? 'text-align:right' : ''}">${col.label}${sortIcon}</th>`;
      })
      .join('');

    this.theadRow.querySelectorAll('th').forEach((th) => {
      const col = this.columns.find((c) => c.key === th.dataset.key);
      if (col && col.sortable) {
        th.addEventListener('click', () => this._toggleSort(col.key));
      }
    });
  }

  _toggleSort(key) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.page = 1;
    this._render();
  }

  setSearchTerm(term) {
    this.searchTerm = term.trim().toLowerCase();
    this.page = 1;
    this._render();
  }

  setData(rows) {
    this.rows = rows;
    this.page = 1;
    this._render();
  }

  showLoading(rowCount = 6) {
    this.tbody.innerHTML = Array.from({ length: rowCount })
      .map(
        () => `<tr class="skeleton-row">${this.columns.map(() => `<td><div class="skeleton"></div></td>`).join('')}</tr>`
      )
      .join('');
    this.paginationInfo.textContent = '';
    this.paginationControls.innerHTML = '';
  }

  _getFiltered() {
    let data = this.rows;
    if (this.searchTerm) {
      data = data.filter((row) => this.searchMatch(row, this.searchTerm));
    }
    if (this.sortKey) {
      data = [...data].sort((a, b) => {
        const av = a[this.sortKey];
        const bv = b[this.sortKey];
        if (av === bv) return 0;
        const cmp = av > bv ? 1 : -1;
        return this.sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }

  _render() {
    const filtered = this._getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    this.page = Math.min(this.page, totalPages);
    const start = (this.page - 1) * this.pageSize;
    const pageRows = filtered.slice(start, start + this.pageSize);

    if (!filtered.length) {
      this.tbody.innerHTML = `
        <tr><td colspan="${this.columns.length}">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <h3>${this.emptyState.title}</h3>
            <p>${this.emptyState.message}</p>
          </div>
        </td></tr>`;
    } else {
      this.tbody.innerHTML = pageRows
        .map(
          (row) => `<tr>${this.columns
            .map((col) => `<td class="${col.align === 'right' ? 'num' : ''} ${col.wrap ? 'wrap' : ''}">${col.render(row)}</td>`)
            .join('')}</tr>`
        )
        .join('');

      if (this.onRowsRendered) this.onRowsRendered(pageRows);
    }

    this.paginationInfo.textContent = filtered.length
      ? `Showing ${start + 1}–${Math.min(start + this.pageSize, filtered.length)} of ${filtered.length}`
      : '';

    this.paginationControls.innerHTML = filtered.length
      ? `
        <button class="btn btn-ghost btn-sm" data-page="prev" ${this.page === 1 ? 'disabled' : ''}>Prev</button>
        <span class="text-secondary" style="padding:0 8px;">${this.page} / ${totalPages}</span>
        <button class="btn btn-ghost btn-sm" data-page="next" ${this.page === totalPages ? 'disabled' : ''}>Next</button>
      `
      : '';

    const prevBtn = this.paginationControls.querySelector('[data-page="prev"]');
    const nextBtn = this.paginationControls.querySelector('[data-page="next"]');
    if (prevBtn) prevBtn.addEventListener('click', () => { this.page--; this._render(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { this.page++; this._render(); });
  }
}

window.DataTable = DataTable;
