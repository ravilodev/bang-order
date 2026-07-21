// ============================================================
// DRAWER COMPONENT — slide panel, used instead of stacked modals
// Usage:
//   Drawer.open({ title: 'Edit Notes', body: '<div>...</div>', onClose(){} });
//   Drawer.close();
// ============================================================

const Drawer = (() => {
  let overlayEl, drawerEl, initialized = false;

  function init() {
    if (initialized) return;
    overlayEl = document.createElement('div');
    overlayEl.className = 'drawer-overlay';
    overlayEl.addEventListener('click', close);

    drawerEl = document.createElement('div');
    drawerEl.className = 'drawer';
    drawerEl.innerHTML = `
      <div class="drawer__header">
        <h3 data-role="drawer-title"></h3>
        <button class="btn btn-ghost btn-icon" data-role="drawer-close" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="drawer__body" data-role="drawer-body"></div>
      <div class="drawer__footer" data-role="drawer-footer"></div>
    `;
    drawerEl.querySelector('[data-role="drawer-close"]').addEventListener('click', close);

    document.body.appendChild(overlayEl);
    document.body.appendChild(drawerEl);
    initialized = true;
  }

  function open({ title, bodyHtml, footerHtml = '' }) {
    init();
    drawerEl.querySelector('[data-role="drawer-title"]').textContent = title;
    drawerEl.querySelector('[data-role="drawer-body"]').innerHTML = bodyHtml;
    drawerEl.querySelector('[data-role="drawer-footer"]').innerHTML = footerHtml;
    requestAnimationFrame(() => {
      overlayEl.classList.add('open');
      drawerEl.classList.add('open');
    });
    return drawerEl;
  }

  function close() {
    if (!initialized) return;
    overlayEl.classList.remove('open');
    drawerEl.classList.remove('open');
  }

  return { open, close };
})();

window.Drawer = Drawer;
