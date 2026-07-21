// ============================================================
// DROPDOWN COMPONENT — lightweight menu attached to a trigger element
// Usage:
//   Dropdown.attach(triggerEl, [
//     { label: 'Rename', icon: svg, onClick: () => {} },
//     { divider: true },
//     { label: 'Deactivate', danger: true, onClick: () => {} },
//   ]);
// ============================================================

const Dropdown = {
  attach(triggerEl, items) {
    const wrap = document.createElement('div');
    wrap.className = 'dropdown';
    triggerEl.replaceWith(wrap);
    wrap.appendChild(triggerEl);

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.innerHTML = items
      .map((item) => {
        if (item.divider) return `<div class="dropdown-menu__divider"></div>`;
        return `<div class="dropdown-menu__item ${item.danger ? 'dropdown-menu__item--danger' : ''}" data-idx="${items.indexOf(item)}">
          ${item.icon || ''}<span>${item.label}</span>
        </div>`;
      })
      .join('');
    wrap.appendChild(menu);

    triggerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.dropdown-menu.open').forEach((m) => {
        if (m !== menu) m.classList.remove('open');
      });
      menu.classList.toggle('open');
    });

    menu.querySelectorAll('.dropdown-menu__item').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.idx);
        menu.classList.remove('open');
        items[idx].onClick?.();
      });
    });

    document.addEventListener('click', () => menu.classList.remove('open'));

    return wrap;
  },
};

window.Dropdown = Dropdown;
