// ============================================================
// SUPABASE CONFIGURATION
// ------------------------------------------------------------
// Replace the two values below with your own project credentials.
// Get them from: Supabase Dashboard → Project Settings → API
// ============================================================

const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";

// Supabase JS client is loaded globally via CDN script tag in each HTML page
// (see <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Guard: warn loudly in console if config was never filled in
if (SUPABASE_URL.includes("YOUR_PROJECT_ID")) {
  console.warn(
    "[Bang Order] Supabase is not configured yet. Edit js/config/supabase.config.js with your project URL and anon key."
  );
}
