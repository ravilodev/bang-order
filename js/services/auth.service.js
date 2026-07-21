// ============================================================
// AUTH SERVICE — the only file that talks to Supabase Auth
// ============================================================

const AuthService = {
  /** Sign in with email + password */
  async signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  /** Sign out current user */
  async signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  },

  /** Get current session (or null) */
  async getSession() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /** Get current user (or null) */
  async getUser() {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) return null;
    return data.user;
  },

  /**
   * Guard for protected pages: redirect to login if no session.
   * Call at the top of every protected page's <script>.
   */
  async requireSession() {
    const session = await this.getSession();
    if (!session) {
      window.location.href = '/pages/login.html';
      return null;
    }
    return session;
  },
};

window.AuthService = AuthService;
