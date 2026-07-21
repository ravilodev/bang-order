// ============================================================
// TOAST COMPONENT — global notification stack
// Usage: Toast.success('Store created'); Toast.error('Failed to save');
// ============================================================

const Toast = (() => {
  let stackEl = null;

  function ensureStack() {
    if (!stackEl) {
      stackEl = document.createElement('div');
      stackEl.className = 'toast-stack';
      document.body.appendChild(stackEl);
    }
    return stackEl;
  }

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  function show(message, type = 'info', duration = 3200) {
    const stack = ensureStack();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `${ICONS[type]}<span>${message}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'all 200ms ease';
      setTimeout(() => el.remove(), 200);
    }, duration);
  }

  return {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error'),
    info: (msg) => show(msg, 'info'),
  };
})();

window.Toast = Toast;
