// ============================================================
// CONFIRM DIALOG — small centered modal for actions that need a
// deliberate confirmation step (bulk edits, deletions). Not for
// complex forms — use Drawer for anything beyond a yes/no choice.
// Usage:
//   ConfirmDialog.open({
//     title: 'Update 87 orders?',
//     message: 'This will set 87 selected orders to Shipped.',
//     confirmLabel: 'Set Shipped',
//     onConfirm: async () => { ... }
//   });
// ============================================================

const ConfirmDialog = {
  open({ title, message, confirmLabel, cancelLabel, danger = false, onConfirm }) {
    const resolvedConfirmLabel = confirmLabel || t('common.confirm');
    const resolvedCancelLabel = cancelLabel || t('common.cancel');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>${title}</h3>
        <p class="modal-card__message">${message}</p>
        <div class="modal-card__footer">
          <button class="btn btn-secondary" data-role="cancel">${resolvedCancelLabel}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-role="confirm">${resolvedConfirmLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    function close() {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('[data-role="cancel"]').addEventListener('click', close);
    overlay.querySelector('[data-role="confirm"]').addEventListener('click', async () => {
      const confirmBtn = overlay.querySelector('[data-role="confirm"]');
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner"></span>';
      try {
        await onConfirm?.();
      } finally {
        close();
      }
    });
  },
};

window.ConfirmDialog = ConfirmDialog;
