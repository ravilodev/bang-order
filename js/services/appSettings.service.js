// ============================================================
// APP SETTINGS SERVICE — single-row branding config (app name +
// logo), so buyers of this source code can white-label the app from
// Settings without touching code. The only file that reads/writes
// `app_settings`.
// ============================================================

const DEFAULT_APP_NAME = 'Bang Order';

const AppSettingsService = {
  /** Returns { appName, logoDataUrl } — falls back to defaults if the row is somehow missing. */
  async get() {
    const { data, error } = await supabaseClient
      .from('app_settings')
      .select('app_name, logo_data_url')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { appName: DEFAULT_APP_NAME, logoDataUrl: null };
    return { appName: data.app_name || DEFAULT_APP_NAME, logoDataUrl: data.logo_data_url || null };
  },

  /** Update app name and/or logo. Pass logoDataUrl: null to remove a custom logo. */
  async update({ appName, logoDataUrl }) {
    const { error } = await supabaseClient
      .from('app_settings')
      .update({ app_name: appName, logo_data_url: logoDataUrl, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw error;
  },
};

window.AppSettingsService = AppSettingsService;
window.DEFAULT_APP_NAME = DEFAULT_APP_NAME;
