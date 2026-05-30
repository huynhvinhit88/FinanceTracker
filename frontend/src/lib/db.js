import { supabase } from './supabaseClient';

export const DEFAULT_CATEGORIES = [
  { name: 'Trả nợ vay', type: 'expense', icon: '🏦', color_hex: '#EF4444' },
  { name: 'Chi hộ', type: 'expense', icon: '🤝', color_hex: '#EF4444' },
  { name: 'Lương', type: 'income', icon: '💰', color_hex: '#10B981' },
  { name: 'Thưởng', type: 'income', icon: '🎁', color_hex: '#F59E0B' },
  { name: 'Thu hộ', type: 'income', icon: '🤝', color_hex: '#10B981' },
  { name: 'Thu hồi nợ', type: 'income', icon: '💰', color_hex: '#10B981' },
];

class SupabaseTableWrapper {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async toArray() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return [];
    
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', user.id);
    if (error) {
      console.error(`Error querying ${this.tableName} from Supabase:`, error);
      throw error;
    }
    return data || [];
  }

  async get(idOrQuery) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;
    
    let query = supabase.from(this.tableName).select('*');
    if (typeof idOrQuery === 'object') {
      Object.entries(idOrQuery).forEach(([key, val]) => {
        query = query.eq(key, val);
      });
    } else {
      query = query.eq(this.tableName === 'settings' ? 'key' : 'id', idOrQuery);
    }
    
    query = query.eq('user_id', user.id);
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error(`Error get in ${this.tableName}:`, error);
      throw error;
    }
    return data || null;
  }

  async add(item) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Not authenticated');
    
    const record = { ...item, user_id: user.id };
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(record)
      .select()
      .single();
    if (error) {
      console.error(`Error adding to ${this.tableName}:`, error);
      throw error;
    }
    return data;
  }

  async put(item) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Not authenticated');
    
    const record = { ...item, user_id: user.id };
    
    const upsertOptions = {};
    if (this.tableName === 'settings') {
      upsertOptions.onConflict = 'key,user_id';
    } else {
      upsertOptions.onConflict = 'id';
    }
    
    const { data, error } = await supabase
      .from(this.tableName)
      .upsert(record, upsertOptions)
      .select()
      .single();
      
    if (error) {
      console.error(`Error putting into ${this.tableName}:`, error);
      throw error;
    }
    return data;
  }

  async update(id, updates) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
      
    if (error) {
      console.error(`Error updating ${this.tableName}:`, error);
      throw error;
    }
    return data;
  }

  async delete(id) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq(this.tableName === 'settings' ? 'key' : 'id', id)
      .eq('user_id', user.id);
      
    if (error) {
      console.error(`Error deleting from ${this.tableName}:`, error);
      throw error;
    }
    return true;
  }

  async clear() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('user_id', user.id);
      
    if (error) {
      console.error(`Error clearing ${this.tableName}:`, error);
      throw error;
    }
    return true;
  }

  async bulkAdd(items) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Not authenticated');
    
    const records = items.map(item => ({ ...item, user_id: user.id }));
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(records)
      .select();
      
    if (error) {
      console.error(`Error bulk adding to ${this.tableName}:`, error);
      throw error;
    }
    return data || [];
  }

  filter(fn) {
    return {
      toArray: async () => {
        const all = await this.toArray();
        return all.filter(fn);
      }
    };
  }

  async count() {
    const all = await this.toArray();
    return all.length;
  }
}

export const db = {
  settings: new SupabaseTableWrapper('settings'),
  accounts: new SupabaseTableWrapper('accounts'),
  categories: new SupabaseTableWrapper('categories'),
  transactions: new SupabaseTableWrapper('transactions'),
  loans: new SupabaseTableWrapper('loans'),
  budgets: new SupabaseTableWrapper('budgets'),
  investments: new SupabaseTableWrapper('investments'),
  savings: new SupabaseTableWrapper('savings'),
  goals: new SupabaseTableWrapper('goals')
};

export async function updateLastModified() {
  try {
    const now = new Date().toISOString();
    await db.settings.put({ key: 'last_updated_at', value: now });
  } catch (err) {
    console.error('Failed to update last_updated_at on Supabase:', err);
  }
}

export async function seedDefaultData() {
  try {
    const seeded = await db.settings.get('has_seeded_categories');
    if (seeded && seeded.value === 'true') return;

    const count = await db.categories.count();
    if (count === 0) {
      await db.categories.bulkAdd(DEFAULT_CATEGORIES.map(c => ({
        ...c,
        id: crypto.randomUUID(),
        is_default: true
      })));
    }
    await db.settings.put({ key: 'has_seeded_categories', value: 'true' });
  } catch (err) {
    console.error('Failed to seed default categories on Supabase:', err);
  }
}
