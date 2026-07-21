// ============================================================
// PROGRESS STEPPER — full-screen overlay showing import pipeline
// progress: Reading -> Validating -> Duplicate Check -> Saving -> Refreshing
// Usage:
//   const stepper = ProgressStepper.open(['Reading Excel', 'Validating Data', ...]);
//   stepper.setActive(1);
//   stepper.setDone(1);
//   stepper.close();
// ============================================================

const ProgressStepper = {
  open(steps) {
    const overlay = document.createElement('div');
    overlay.className = 'import-overlay';
    overlay.innerHTML = `
      <div class="stepper-card">
        <h3>${t('import.steps.title')}</h3>
        <div class="step-list">
          ${steps
            .map(
              (label, i) => `
            <div class="step-item" data-step="${i}">
              <span class="step-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span class="step-label">${label}</span>
            </div>`
            )
            .join('')}
        </div>
        <p class="stepper-card__footnote">${t('import.steps.pleaseWait')}</p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const items = overlay.querySelectorAll('.step-item');

    return {
      setActive(index) {
        items.forEach((item, i) => {
          item.classList.toggle('active', i === index);
        });
      },
      setDone(index) {
        items[index]?.classList.remove('active');
        items[index]?.classList.add('done');
      },
      setFootnote(text) {
        overlay.querySelector('.stepper-card__footnote').textContent = text;
      },
      close() {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 200);
      },
    };
  },
};

window.ProgressStepper = ProgressStepper;
