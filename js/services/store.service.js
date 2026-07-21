// ============================================================
// STORE SERVICE — all Supabase access for the `stores` table
// ============================================================

const StoreService = {
  /** All active stores, for dropdowns */
  async getActiveStores() {
    const { data, error } = await supabaseClient
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('store_name', { ascending: true });
    if (error) throw error;
    return data;
  },

  /** All stores (active + inactive), for Settings management */
  async getAllStores() {
    const { data, error } = await supabaseClient
      .from('stores')
      .select('*')
      .order('store_name', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createStore(storeName) {
    const { data, error } = await supabaseClient
      .from('stores')
      .insert({ store_name: storeName.trim(), is_active: true })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async renameStore(storeId, newName) {
    const { data, error } = await supabaseClient
      .from('stores')
      .update({ store_name: newName.trim() })
      .eq('id', storeId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async setActive(storeId, isActive) {
    const { data, error } = await supabaseClient
      .from('stores')
      .update({ is_active: isActive })
      .eq('id', storeId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

window.StoreService = StoreService;
