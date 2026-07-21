// ============================================================
// SETTINGS PAGE CONTROLLER
// ============================================================

const MAX_LOGO_BYTES = 300 * 1024; // 300 KB

(async function initSettings() {
  await AuthService.requireSession();
  const content = await Shell.render({
    active: 'settings',
    titleKey: 'settings.title',
    subtitleKey: 'settings.subtitle',
  });

  let branding = { appName: window.DEFAULT_APP_NAME || 'Bang Order', logoDataUrl: null };
  let brandingMigrationMissing = false;
  try {
    branding = await AppSettingsService.get();
  } catch (err) {
    console.warn('[Bang Order] app_settings not found — has migration 007 been run?', err.message);
    brandingMigrationMissing = true;
  }

  content.insertAdjacentHTML(
    'beforeend',
    `
    <div class="settings-layout">
      <nav class="settings-nav">
        <div class="settings-nav__item active" data-section="stores">${t('settings.nav.stores')}</div>
        <div class="settings-nav__item" data-section="branding">${t('settings.nav.branding')}</div>
        <div class="settings-nav__item" data-section="language">${t('settings.nav.language')}</div>
        <div class="settings-nav__item" data-section="about">${t('settings.nav.about')}</div>
        <div class="settings-nav__item" data-section="account">${t('settings.nav.account')}</div>
      </nav>

      <div>
        <section class="settings-section active card" id="section-stores">
          <div class="page-header" style="margin-bottom:var(--space-2);">
            <h2>${t('settings.stores.title')}</h2>
            <button class="btn btn-primary btn-sm" id="add-store-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              ${t('settings.stores.addStore')}
            </button>
          </div>
          <div id="store-list"></div>
        </section>

        <section class="settings-section card" id="section-branding">
          <h2 style="margin-bottom:4px;">${t('settings.branding.title')}</h2>
          <p class="text-secondary" style="font-size:13.5px; margin-bottom:var(--space-3);">${t('settings.branding.description')}</p>
          ${brandingMigrationMissing ? `
            <div class="import-note" style="background: var(--color-danger-soft); margin-bottom: var(--space-2);">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Database not ready for this feature yet — run <code>sql/migrations/007_branding.sql</code> in your Supabase project's SQL Editor, then reload this page.</span>
            </div>
          ` : ''}

          <div class="field" style="max-width:320px;">
            <label>${t('settings.branding.appNameLabel')}</label>
            <input class="input" id="branding-app-name" value="${branding.appName}" placeholder="${t('settings.branding.appNamePlaceholder')}" />
          </div>

          <div class="field" style="max-width:320px;">
            <label>${t('settings.branding.logoLabel')}</label>
            <div style="display:flex; align-items:center; gap:12px;">
              <div id="logo-preview" style="width:56px; height:56px; border-radius:10px; border:1px solid var(--color-border); display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--color-bg); flex-shrink:0;">
                ${branding.logoDataUrl ? `<img src="${branding.logoDataUrl}" alt="" style="width:100%; height:100%; object-fit:cover;" />` : `<span style="font-weight:700; color:var(--color-primary); font-size:20px;">${branding.appName.charAt(0).toUpperCase()}</span>`}
              </div>
              <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-secondary btn-sm" id="upload-logo-btn">${t('settings.branding.uploadLogo')}</button>
                  <button class="btn btn-ghost btn-sm" id="remove-logo-btn" ${branding.logoDataUrl ? '' : 'style="display:none;"'}>${t('settings.branding.removeLogo')}</button>
                </div>
                <span class="text-muted" style="font-size:12px;">${t('settings.branding.logoHint')}</span>
              </div>
              <input type="file" id="logo-file-input" accept="image/png,image/jpeg,image/jpg" style="display:none;" />
            </div>
            <span class="text-muted" id="branding-error" style="font-size:12px;"></span>
          </div>

          <button class="btn btn-primary" id="save-branding-btn" style="margin-top:var(--space-2);">${t('settings.branding.saveButton')}</button>
        </section>

        <section class="settings-section card" id="section-language">
          <h2 style="margin-bottom:4px;">${t('settings.language.title')}</h2>
          <p class="text-secondary" style="font-size:13.5px; margin-bottom:var(--space-2);">${t('settings.language.description')}</p>
          <div style="display:flex; gap:8px;">
            <button class="btn ${I18n.getLocale() === 'id' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-locale="id">${t('settings.language.indonesian')}</button>
            <button class="btn ${I18n.getLocale() === 'en' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-locale="en">${t('settings.language.english')}</button>
          </div>
        </section>

        <section class="settings-section card" id="section-about">
          <h2 style="margin-bottom:var(--space-2);">${t('settings.nav.about')}</h2>
          <div class="about-list">
            <div class="about-list__row"><span class="text-secondary">${t('settings.about.appName')}</span><span>${branding.appName}</span></div>
            <div class="about-list__row"><span class="text-secondary">${t('settings.about.purpose')}</span><span>${t('settings.about.purposeValue')}</span></div>
            <div class="about-list__row"><span class="text-secondary">${t('settings.about.version')}</span><span>${t('settings.about.versionValue')}</span></div>
            <div class="about-list__row"><span class="text-secondary">${t('settings.about.backend')}</span><span>Supabase (PostgreSQL + Auth)</span></div>
            <div class="about-list__row"><span class="text-secondary">${t('settings.about.hosting')}</span><span>Vercel</span></div>
          </div>
          <h2 style="margin:var(--space-3) 0 var(--space-2);">${t('settings.about.backupTitle')}</h2>
          <p class="text-secondary" style="font-size:13.5px;">${t('settings.about.backupText')}</p>
        </section>

        <section class="settings-section card" id="section-account">
          <h2 style="margin-bottom:var(--space-2);">${t('settings.nav.account')}</h2>
          <p class="text-secondary" style="font-size:13.5px; margin-bottom:var(--space-2);" id="account-email"></p>
          <button class="btn btn-secondary" id="logout-btn-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            ${t('nav.logout')}
          </button>
        </section>
      </div>
    </div>
    `
  );

  if (window.lucide) lucide.createIcons();

  // Section switching
  document.querySelectorAll('.settings-nav__item').forEach((navItem) => {
    navItem.addEventListener('click', () => {
      document.querySelectorAll('.settings-nav__item').forEach((n) => n.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach((s) => s.classList.remove('active'));
      navItem.classList.add('active');
      document.getElementById(`section-${navItem.dataset.section}`).classList.add('active');
    });
  });

  // Language switcher — not a SPA, so switching locale just persists the
  // choice and reloads the current page to re-render with new strings.
  document.querySelectorAll('[data-locale]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.locale === I18n.getLocale()) return;
      I18n.setLocale(btn.dataset.locale);
      window.location.reload();
    });
  });

  // ---------- Branding ----------
  let pendingLogoDataUrl = branding.logoDataUrl; // null means "no logo" / removed

  const logoFileInput = document.getElementById('logo-file-input');
  const logoPreview = document.getElementById('logo-preview');
  const removeLogoBtn = document.getElementById('remove-logo-btn');
  const brandingError = document.getElementById('branding-error');

  document.getElementById('upload-logo-btn').addEventListener('click', () => logoFileInput.click());

  logoFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    brandingError.textContent = '';

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      brandingError.textContent = t('settings.branding.invalidFileType');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      brandingError.textContent = t('settings.branding.fileTooLarge');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      pendingLogoDataUrl = reader.result;
      logoPreview.innerHTML = `<img src="${pendingLogoDataUrl}" alt="" style="width:100%; height:100%; object-fit:cover;" />`;
      removeLogoBtn.style.display = '';
    };
    reader.readAsDataURL(file);
  });

  removeLogoBtn.addEventListener('click', () => {
    pendingLogoDataUrl = null;
    logoFileInput.value = '';
    const nameForInitial = document.getElementById('branding-app-name').value || 'B';
    logoPreview.innerHTML = `<span style="font-weight:700; color:var(--color-primary); font-size:20px;">${nameForInitial.charAt(0).toUpperCase()}</span>`;
    removeLogoBtn.style.display = 'none';
  });

  document.getElementById('save-branding-btn').addEventListener('click', async () => {
    if (brandingMigrationMissing) {
      Toast.error('Run sql/migrations/007_branding.sql first — see the notice above.');
      return;
    }
    const appName = document.getElementById('branding-app-name').value.trim();
    if (!appName) {
      brandingError.textContent = t('settings.branding.nameRequired');
      return;
    }
    try {
      await AppSettingsService.update({ appName, logoDataUrl: pendingLogoDataUrl });
      Toast.success(t('settings.branding.toast.saved'));
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error(err);
      Toast.error(t('settings.branding.toast.saveFailed'));
    }
  });

  const user = await AuthService.getUser();
  document.getElementById('account-email').textContent = t('settings.account.signedInAs', { email: user?.email || '—' });
  document.getElementById('logout-btn-2').addEventListener('click', async () => {
    await AuthService.signOut();
    window.location.href = '/pages/login.html';
  });

  document.getElementById('add-store-btn').addEventListener('click', openAddStoreDrawer);

  async function loadStores() {
    const listEl = document.getElementById('store-list');
    listEl.innerHTML = `<div class="skeleton" style="height:48px;"></div>`;
    try {
      const stores = await StoreService.getAllStores();
      if (!stores.length) {
        listEl.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M5 21V7l8-4v18M13 21V11l6 4v6"/></svg>
            <h3>${t('settings.stores.empty.title')}</h3>
            <p>${t('settings.stores.empty.message')}</p>
          </div>`;
        return;
      }
      listEl.innerHTML = stores.map((s) => storeRowHtml(s)).join('');
      stores.forEach((s) => wireStoreRow(s));
    } catch (err) {
      console.error(err);
      Toast.error(t('settings.stores.toast.loadFailed'));
    }
  }

  function storeRowHtml(store) {
    return `
      <div class="store-row" data-store-id="${store.id}">
        <div>
          <div class="store-row__name">${store.store_name}</div>
          <div class="store-row__meta">${store.is_active ? t('settings.stores.active') : t('settings.stores.inactive')}</div>
        </div>
        <div class="store-row__actions">
          <button class="btn btn-secondary btn-sm" data-action="rename">${t('settings.stores.rename')}</button>
          <button class="btn ${store.is_active ? 'btn-danger' : 'btn-success'} btn-sm" data-action="toggle">
            ${store.is_active ? t('settings.stores.deactivate') : t('settings.stores.activate')}
          </button>
        </div>
      </div>`;
  }

  function wireStoreRow(store) {
    const row = document.querySelector(`.store-row[data-store-id="${store.id}"]`);
    row.querySelector('[data-action="rename"]').addEventListener('click', () => openRenameDrawer(store));
    row.querySelector('[data-action="toggle"]').addEventListener('click', async () => {
      try {
        await StoreService.setActive(store.id, !store.is_active);
        Toast.success(store.is_active ? t('settings.stores.toast.deactivated') : t('settings.stores.toast.activated'));
        loadStores();
      } catch (err) {
        console.error(err);
        Toast.error(t('settings.stores.toast.toggleFailed'));
      }
    });
  }

  function openAddStoreDrawer() {
    Drawer.open({
      title: t('settings.stores.addDrawerTitle'),
      bodyHtml: `
        <div class="field">
          <label>${t('settings.stores.storeName')}</label>
          <input class="input" id="new-store-name" placeholder="${t('settings.stores.storeNamePlaceholder')}" />
          <span class="text-muted" id="new-store-error" style="font-size:12px;"></span>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" id="drawer-cancel">${t('common.cancel')}</button>
        <button class="btn btn-primary" id="drawer-save">${t('common.save')}</button>
      `,
    });
    document.getElementById('drawer-cancel').addEventListener('click', Drawer.close);
    document.getElementById('drawer-save').addEventListener('click', async () => {
      const name = document.getElementById('new-store-name').value;
      const error = Validators.validateStoreName(name);
      if (error) {
        document.getElementById('new-store-error').textContent = error;
        return;
      }
      try {
        await StoreService.createStore(name);
        Toast.success(t('settings.stores.toast.created'));
        Drawer.close();
        loadStores();
      } catch (err) {
        console.error(err);
        Toast.error(t('settings.stores.toast.createFailed'));
      }
    });
  }

  function openRenameDrawer(store) {
    Drawer.open({
      title: t('settings.stores.renameDrawerTitle'),
      bodyHtml: `
        <div class="field">
          <label>${t('settings.stores.storeName')}</label>
          <input class="input" id="rename-store-name" value="${store.store_name}" />
          <span class="text-muted" id="rename-store-error" style="font-size:12px;"></span>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" id="drawer-cancel">${t('common.cancel')}</button>
        <button class="btn btn-primary" id="drawer-save">${t('common.save')}</button>
      `,
    });
    document.getElementById('drawer-cancel').addEventListener('click', Drawer.close);
    document.getElementById('drawer-save').addEventListener('click', async () => {
      const name = document.getElementById('rename-store-name').value;
      const error = Validators.validateStoreName(name);
      if (error) {
        document.getElementById('rename-store-error').textContent = error;
        return;
      }
      try {
        await StoreService.renameStore(store.id, name);
        Toast.success(t('settings.stores.toast.renamed'));
        Drawer.close();
        loadStores();
      } catch (err) {
        console.error(err);
        Toast.error(t('settings.stores.toast.renameFailed'));
      }
    });
  }

  loadStores();
})();
