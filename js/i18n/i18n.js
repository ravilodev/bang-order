// ============================================================
// I18N RUNTIME — minimal translation system for a 2-language app
// (Indonesian default, English toggle). No RTL needed since both
// languages are left-to-right.
//
// Usage:
//   I18n.t('nav.dashboard')                    -> "Dasbor" / "Dashboard"
//   I18n.t('orders.bulk.selected', { n: 5 })    -> "5 pesanan dipilih" / "5 orders selected"
//   I18n.getLocale() / I18n.setLocale('en')
//
// Persistence: localStorage is fine here — this is a real deployed
// app the user hosts themselves, not a Claude.ai artifact preview
// (where localStorage is unavailable).
// ============================================================

const I18n = (() => {
  const STORAGE_KEY = 'bang_order_locale';
  const DEFAULT_LOCALE = 'id';

  function getLocale() {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  }

  function setLocale(locale) {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore storage failures — falls back to default next load */
    }
  }

  /** Look up a dot-path key (e.g. "orders.table.trackingNumber") */
  function resolve(dict, path) {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dict);
  }

  /**
   * Translate a key for the current locale. Falls back to English,
   * then to the raw key itself, so a missing translation never
   * breaks the UI — it just shows something readable.
   */
  function t(key, vars = {}) {
    const locale = getLocale();
    let str = resolve(TRANSLATIONS[locale], key);
    if (str === undefined) str = resolve(TRANSLATIONS.en, key);
    if (str === undefined) return key;

    return Object.keys(vars).reduce((acc, varKey) => acc.replace(`{${varKey}}`, vars[varKey]), str);
  }

  return { t, getLocale, setLocale };
})();

window.I18n = I18n;
window.t = I18n.t; // short global alias, used throughout the app
