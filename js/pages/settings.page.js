// ============================================================
// SETTINGS PAGE CONTROLLER
// ============================================================

(async function initSettings() {
  await AuthService.requireSession();
  const content = await Shell.render({
    active: 'settings',
    title: 'Settings',
    subtitle: 'Manage stores and application preferences',
  });

  content.insertAdjacentHTML(
    'beforeend',
    `
    <div class="settings-layout">
      <nav class="settings-nav">
        <div class="settings-nav__item active" data-section="stores">Store Management</div>
        <div class="settings-nav__item" data-section="about">About Application</div>
        <div class="settings-nav__item" data-section="account">Account</div>
      </nav>

      <div>
        <section class="settings-section active card" id="section-stores">
          <div class="page-header" style="margin-bottom:var(--space-2);">
            <h2>Stores</h2>
            <button class="btn btn-primary btn-sm" id="add-store-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Store
            </button>
          </div>
          <div id="store-list"></div>
        </section>

        <section class="settings-section card" id="section-about">
          <h2 style="margin-bottom:var(--space-2);">About Application</h2>
          <div class="about-list">
            <div class="about-list__row"><span class="text-secondary">Application</span><span>Bang Order</span></div>
            <div class="about-list__row"><span class="text-secondary">Purpose</span><span>Shopee order recap & fulfillment validation</span></div>
            <div class="about-list__row"><span class="text-secondary">Version</span><span>1.0.0</span></div>
            <div class="about-list__row"><span class="text-secondary">Backend</span><span>Supabase (PostgreSQL + Auth)</span></div>
            <div class="about-list__row"><span class="text-secondary">Hosting</span><span>Vercel</span></div>
          </div>
          <h2 style="margin:var(--space-3) 0 var(--space-2);">Database Backup Information</h2>
          <p class="text-secondary" style="font-size:13.5px;">
            Data is stored on Supabase PostgreSQL. Supabase performs automatic daily backups on paid plans.
            For manual backups, use the Supabase Dashboard → Database → Backups, or export tables via the
            Supabase CLI (<code>supabase db dump</code>).
          </p>
        </section>

        <section class="settings-section card" id="section-account">
          <h2 style="margin-bottom:var(--space-2);">Account</h2>
          <p class="text-secondary" style="font-size:13.5px; margin-bottom:var(--space-2);" id="account-email"></p>
          <button class="btn btn-secondary" id="logout-btn-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
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

  const user = await AuthService.getUser();
  document.getElementById('account-email').textContent = `Signed in as ${user?.email || '—'}`;
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
            <h3>No stores yet</h3>
            <p>Add your first Shopee store to start importing orders.</p>
          </div>`;
        return;
      }
      listEl.innerHTML = stores.map((s) => storeRowHtml(s)).join('');
      stores.forEach((s) => wireStoreRow(s));
    } catch (err) {
      console.error(err);
      Toast.error('Failed to load stores');
    }
  }

  function storeRowHtml(store) {
    return `
      <div class="store-row" data-store-id="${store.id}">
        <div>
          <div class="store-row__name">${store.store_name}</div>
          <div class="store-row__meta">${store.is_active ? 'Active' : 'Inactive'}</div>
        </div>
        <div class="store-row__actions">
          <button class="btn btn-secondary btn-sm" data-action="rename">Rename</button>
          <button class="btn ${store.is_active ? 'btn-danger' : 'btn-success'} btn-sm" data-action="toggle">
            ${store.is_active ? 'Deactivate' : 'Activate'}
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
        Toast.success(store.is_active ? 'Store deactivated' : 'Store activated');
        loadStores();
      } catch (err) {
        console.error(err);
        Toast.error('Failed to update store');
      }
    });
  }

  function openAddStoreDrawer() {
    Drawer.open({
      title: 'Add Store',
      bodyHtml: `
        <div class="field">
          <label>Store Name</label>
          <input class="input" id="new-store-name" placeholder="e.g. My Shopee Store" />
          <span class="text-muted" id="new-store-error" style="font-size:12px;"></span>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" id="drawer-cancel">Cancel</button>
        <button class="btn btn-primary" id="drawer-save">Save</button>
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
        Toast.success('Store created');
        Drawer.close();
        loadStores();
      } catch (err) {
        console.error(err);
        Toast.error('Failed to create store');
      }
    });
  }

  function openRenameDrawer(store) {
    Drawer.open({
      title: 'Rename Store',
      bodyHtml: `
        <div class="field">
          <label>Store Name</label>
          <input class="input" id="rename-store-name" value="${store.store_name}" />
          <span class="text-muted" id="rename-store-error" style="font-size:12px;"></span>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" id="drawer-cancel">Cancel</button>
        <button class="btn btn-primary" id="drawer-save">Save</button>
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
        Toast.success('Store renamed');
        Drawer.close();
        loadStores();
      } catch (err) {
        console.error(err);
        Toast.error('Failed to rename store');
      }
    });
  }

  loadStores();
})();
