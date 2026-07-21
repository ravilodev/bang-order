// ============================================================
// DASHBOARD PAGE CONTROLLER
// ============================================================

(async function initDashboard() {
  await AuthService.requireSession();
  const content = await Shell.render({
    active: 'dashboard',
    titleKey: 'dashboard.title',
    subtitleKey: 'dashboard.subtitle',
  });

  let currentFilter = 'today';
  let currentStoreId = null;
  let charts = {};

  content.insertAdjacentHTML(
    'beforeend',
    `
    <div class="page-header" style="margin-top:-8px;">
      <div class="filter-bar" id="filter-bar">
        <span class="filter-pill active" data-filter="today">${t('dashboard.filters.today')}</span>
        <span class="filter-pill" data-filter="yesterday">${t('dashboard.filters.yesterday')}</span>
        <span class="filter-pill" data-filter="7d">${t('dashboard.filters.last7days')}</span>
        <span class="filter-pill" data-filter="month">${t('dashboard.filters.currentMonth')}</span>
      </div>
      <select class="select" id="store-filter" style="max-width:220px;">
        <option value="">${t('common.allStores')}</option>
      </select>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-card__label">${t('dashboard.stats.totalOrders')}</div>
        <div class="stat-card__value" id="stat-orders">–</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">${t('dashboard.stats.totalItemsSold')}</div>
        <div class="stat-card__value" id="stat-items">–</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">${t('dashboard.stats.totalRevenue')}</div>
        <div class="stat-card__value" id="stat-revenue">–</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">${t('dashboard.stats.aov')}</div>
        <div class="stat-card__value" id="stat-aov">–</div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-card__title">${t('dashboard.charts.dailySales')}</div>
        <div class="chart-card__canvas-wrap"><canvas id="chart-daily-sales"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">${t('dashboard.charts.bestSellingSku')}</div>
        <div class="chart-card__canvas-wrap"><canvas id="chart-best-sku"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">${t('dashboard.charts.ordersPerDay')}</div>
        <div class="chart-card__canvas-wrap"><canvas id="chart-orders-per-day"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-card__title">${t('dashboard.charts.orderStatus')}</div>
        <div class="chart-card__canvas-wrap"><canvas id="chart-order-status"></canvas></div>
      </div>
    </div>
    `
  );

  // Populate store dropdown
  const stores = await StoreService.getActiveStores();
  const storeSelect = document.getElementById('store-filter');
  stores.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.store_name;
    storeSelect.appendChild(opt);
  });
  storeSelect.addEventListener('change', () => {
    currentStoreId = storeSelect.value || null;
    loadMetrics();
  });

  document.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      loadMetrics();
    });
  });

  function getDateRange(filter) {
    const now = new Date();
    const toKey = (d) => d.toISOString().slice(0, 10);
    if (filter === 'today') return { dateFrom: toKey(now), dateTo: toKey(now) };
    if (filter === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { dateFrom: toKey(y), dateTo: toKey(y) };
    }
    if (filter === '7d') {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { dateFrom: toKey(from), dateTo: toKey(now) };
    }
    if (filter === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: toKey(from), dateTo: toKey(now) };
    }
    return { dateFrom: null, dateTo: null };
  }

  async function loadMetrics() {
    const { dateFrom, dateTo } = getDateRange(currentFilter);
    try {
      const metrics = await DashboardService.getMetrics({ storeId: currentStoreId, dateFrom, dateTo });
      renderStats(metrics);
      renderCharts(metrics);
    } catch (err) {
      console.error(err);
      Toast.error(t('dashboard.toast.loadFailed'));
    }
  }

  function renderStats(m) {
    document.getElementById('stat-orders').textContent = Formatters.formatNumber(m.totalOrders);
    document.getElementById('stat-items').textContent = Formatters.formatNumber(m.totalItemsSold);
    document.getElementById('stat-revenue').textContent = Formatters.formatCurrency(m.totalRevenue);
    document.getElementById('stat-aov').textContent = Formatters.formatCurrency(m.aov);
  }

  function renderCharts(m) {
    destroyCharts();

    charts.dailySales = new Chart(document.getElementById('chart-daily-sales'), {
      type: 'line',
      data: {
        labels: m.dailySales.labels,
        datasets: [{
          data: m.dailySales.values,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37,99,235,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        }],
      },
      options: baseChartOptions(),
    });

    charts.bestSku = new Chart(document.getElementById('chart-best-sku'), {
      type: 'bar',
      data: {
        labels: m.bestSellingSku.labels,
        datasets: [{ data: m.bestSellingSku.values, backgroundColor: '#2563EB', borderRadius: 4 }],
      },
      options: { ...baseChartOptions(), indexAxis: 'y' },
    });

    charts.ordersPerDay = new Chart(document.getElementById('chart-orders-per-day'), {
      type: 'bar',
      data: {
        labels: m.ordersPerDay.labels,
        datasets: [{ data: m.ordersPerDay.values, backgroundColor: '#2563EB', borderRadius: 4 }],
      },
      options: baseChartOptions(),
    });

    charts.orderStatus = new Chart(document.getElementById('chart-order-status'), {
      type: 'doughnut',
      data: {
        labels: [t('statusBadge.PENDING'), t('statusBadge.SHIPPED'), t('statusBadge.CANCELLED'), t('statusBadge.REPLACE'), t('statusBadge.RETURNED')],
        datasets: [{
          data: [m.orderStatus.PENDING, m.orderStatus.SHIPPED, m.orderStatus.CANCELLED, m.orderStatus.REPLACE, m.orderStatus.RETURNED],
          backgroundColor: ['#64748B', '#22C55E', '#EF4444', '#166534', '#EA580C'],
          borderWidth: 0,
        }],
      },
      options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }, cutout: '68%' },
    });
  }

  function destroyCharts() {
    Object.values(charts).forEach((c) => c?.destroy());
    charts = {};
  }

  function baseChartOptions() {
    return {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#E2E8F0' }, ticks: { font: { size: 11 } } },
      },
      maintainAspectRatio: false,
    };
  }

  loadMetrics();
})();
