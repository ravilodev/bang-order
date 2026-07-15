// ============================================================
// SHELL — sidebar + topbar chrome shared by every protected page.
// Avoids duplicating nav markup across dashboard/orders/import/settings.
// Usage: Shell.render({ active: 'orders', title: 'Orders', subtitle: '...' })
// ============================================================

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '/pages/dashboard.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>' },
  { key: 'orders', label: 'Orders', href: '/pages/orders.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3z" opacity="0"/><path d="M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1zM9 5h6v2H9z"/></svg>' },
  { key: 'import', label: 'Import', href: '/pages/import.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' },
  { key: 'settings', label: 'Settings', href: '/pages/settings.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
];

const Shell = {
  async render({ active, title, subtitle = '' }) {
    const user = await AuthService.getUser();
    const initials = (user?.email || 'U').slice(0, 2).toUpperCase();

    document.body.insertAdjacentHTML('afterbegin', `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="sidebar__brand">
            <span class="sidebar__brand-mark">B</span>
            <span>Bang Order</span>
          </div>
          <nav class="sidebar__nav">
            ${NAV_ITEMS.map(
              (item) => `
              <a class="nav-item ${item.key === active ? 'active' : ''}" href="${item.href}">
                ${item.icon}<span>${item.label}</span>
              </a>`
            ).join('')}
          </nav>
          <div class="sidebar__footer">
            <div class="nav-item" data-role="logout-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Log out</span>
            </div>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <span class="topbar__title">${title}</span>
            <div class="topbar__actions">
              <div class="user-chip">
                <span class="avatar">${initials}</span>
              </div>
            </div>
          </header>
          <main class="page-content" id="page-content"></main>
        </div>
      </div>
    `);

    document.querySelector('[data-role="logout-btn"]').addEventListener('click', async () => {
      await AuthService.signOut();
      window.location.href = '/pages/login.html';
    });

    if (title || subtitle) {
      const header = document.createElement('div');
      header.className = 'page-header';
      header.innerHTML = `
        <div class="page-header__left">
          <h1>${title}</h1>
          ${subtitle ? `<div class="page-header__subtitle">${subtitle}</div>` : ''}
        </div>
        <div class="page-header__right" id="page-header-actions"></div>
      `;
      document.getElementById('page-content').appendChild(header);
    }

    if (window.lucide) lucide.createIcons();
    return document.getElementById('page-content');
  },
};

window.Shell = Shell;
