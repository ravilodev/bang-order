// ============================================================
// SHELL — sidebar + topbar chrome shared by every protected page.
// Avoids duplicating nav markup across dashboard/orders/import/settings.
// Usage: Shell.render({ active: 'orders', titleKey: 'orders.title', subtitleKey: 'orders.subtitle' })
// ============================================================

const NAV_ITEMS = [
  { key: 'dashboard', labelKey: 'nav.dashboard', href: '/pages/dashboard.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>' },
  { key: 'orders', labelKey: 'nav.orders', href: '/pages/orders.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3z" opacity="0"/><path d="M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1zM9 5h6v2H9z"/></svg>' },
  { key: 'import', labelKey: 'nav.import', href: '/pages/import.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' },
  { key: 'inventory', labelKey: 'nav.inventory', href: '/pages/inventory.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V21H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>' },
  { key: 'returns', labelKey: 'nav.returns', href: '/pages/returns.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>' },
  { key: 'settings', labelKey: 'nav.settings', href: '/pages/settings.html', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
];

/**
 * Fetch branding without ever throwing — if `app_settings` doesn't
 * exist yet (migration 007 not applied), the whole page shouldn't
 * break just because of a cosmetic feature. Falls back to defaults.
 */
async function getBrandingSafely() {
  try {
    return await AppSettingsService.get();
  } catch (err) {
    console.warn('[Bang Order] Could not load branding settings (has migration 007 been run?):', err.message);
    return { appName: window.DEFAULT_APP_NAME || 'Bang Order', logoDataUrl: null };
  }
}

const Shell = {
  /**
   * @param {Object} opts
   * @param {string} opts.active - nav key to highlight
   * @param {string} [opts.titleKey] - translation key for the page title (preferred)
   * @param {string} [opts.subtitleKey] - translation key for the subtitle
   * @param {string} [opts.title] - literal title, used if titleKey isn't given
   * @param {string} [opts.subtitle] - literal subtitle, used if subtitleKey isn't given
   */
  async render({ active, titleKey, subtitleKey, title, subtitle = '' }) {
    const [user, branding] = await Promise.all([AuthService.getUser(), getBrandingSafely()]);
    const initials = (user?.email || 'U').slice(0, 2).toUpperCase();
    const resolvedTitle = titleKey ? t(titleKey) : title;
    const resolvedSubtitle = subtitleKey ? t(subtitleKey) : subtitle;

    document.title = resolvedTitle ? `${resolvedTitle} · ${branding.appName}` : branding.appName;

    const brandMarkHtml = branding.logoDataUrl
      ? `<img src="${branding.logoDataUrl}" alt="" class="sidebar__brand-mark sidebar__brand-mark--image" />`
      : `<span class="sidebar__brand-mark">${(branding.appName || 'B').charAt(0).toUpperCase()}</span>`;

    document.body.insertAdjacentHTML('afterbegin', `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="sidebar__brand">
            ${brandMarkHtml}
            <span>${branding.appName}</span>
          </div>
          <nav class="sidebar__nav">
            ${NAV_ITEMS.map(
              (item) => `
              <a class="nav-item ${item.key === active ? 'active' : ''}" href="${item.href}">
                ${item.icon}<span>${t(item.labelKey)}</span>
              </a>`
            ).join('')}
          </nav>
          <div class="sidebar__footer">
            <div class="nav-item" data-role="logout-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>${t('nav.logout')}</span>
            </div>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <span class="topbar__title">${resolvedTitle}</span>
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

    if (resolvedTitle || resolvedSubtitle) {
      const header = document.createElement('div');
      header.className = 'page-header';
      header.innerHTML = `
        <div class="page-header__left">
          <h1>${resolvedTitle}</h1>
          ${resolvedSubtitle ? `<div class="page-header__subtitle">${resolvedSubtitle}</div>` : ''}
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
