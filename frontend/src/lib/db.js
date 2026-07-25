import { supabase } from './supabaseClient';

export const DEFAULT_CATEGORIES = [
  // === Danh mục Chi (expense) ===
  { name: 'Sinh hoạt', type: 'expense', icon: '🛒', color_hex: '#F97316', sort_order: 1, is_ui_default: true },
  { name: 'Gửi về nhà', type: 'expense', icon: '💸', color_hex: '#F59E0B', sort_order: 2 },
  { name: 'Chi hộ', type: 'expense', icon: '🤝', color_hex: '#EF4444', sort_order: 3 },
  { name: 'Nhà ở', type: 'expense', icon: '🏠', color_hex: '#8B5CF6', sort_order: 4 },
  { name: 'Trả nợ vay', type: 'expense', icon: '🏦', color_hex: '#EF4444', sort_order: 5 },
  { name: 'Học tập', type: 'expense', icon: '📚', color_hex: '#3B82F6', sort_order: 6 },
  { name: 'Du lịch', type: 'expense', icon: '✈️', color_hex: '#06B6D4', sort_order: 7 },
  { name: 'Mua sắm đồ giá trị', type: 'expense', icon: '🛍️', color_hex: '#EC4899', sort_order: 8 },
  { name: 'Quà cáp', type: 'expense', icon: '🎁', color_hex: '#F472B6', sort_order: 9 },
  { name: 'Cho mượn', type: 'expense', icon: '🤲', color_hex: '#EAB308', sort_order: 10 },
  { name: 'Y tế', type: 'expense', icon: '🏥', color_hex: '#EF4444', sort_order: 11 },
  { name: 'Nhà cho thuê', type: 'expense', icon: '🏘️', color_hex: '#8B5CF6', sort_order: 12 },
  { name: 'Chi điều chỉnh', type: 'expense', icon: '⚙️', color_hex: '#64748B', sort_order: 13 },
  // === Danh mục Thu (income) ===
  { name: 'Lương', type: 'income', icon: '💰', color_hex: '#10B981', sort_order: 1, is_ui_default: true },
  { name: 'Cho thuê', type: 'income', icon: '🔑', color_hex: '#10B981', sort_order: 2 },
  { name: 'Thu hồi nợ', type: 'income', icon: '💵', color_hex: '#10B981', sort_order: 3 },
  { name: 'Lãi tiết kiệm', type: 'income', icon: '📈', color_hex: '#14B8A6', sort_order: 4 },
  { name: 'Thu hộ', type: 'income', icon: '🤝', color_hex: '#10B981', sort_order: 5 },
  { name: 'Cash back', type: 'income', icon: '💳', color_hex: '#06B6D4', sort_order: 6 },
  { name: 'Thưởng', type: 'income', icon: '🎁', color_hex: '#F59E0B', sort_order: 7 },
  { name: 'Thu điều chỉnh', type: 'income', icon: '⚙️', color_hex: '#64748B', sort_order: 8 },
  // === Danh mục Chuyển khoản (savings) ===
  { name: 'Tiết kiệm', type: 'savings', icon: '🐷', color_hex: '#3B82F6', sort_order: 1, is_ui_default: true },
  { name: 'Nhà ở TK', type: 'savings', icon: '🏡', color_hex: '#8B5CF6', sort_order: 2 },
  { name: 'Má gửi', type: 'savings', icon: '👩', color_hex: '#EC4899', sort_order: 3 },
  { name: 'Tất toán sổ tiết kiệm', type: 'savings', icon: '🧾', color_hex: '#14B8A6', sort_order: 4 },
  { name: 'Luân chuyển', type: 'savings', icon: '🔄', color_hex: '#64748B', sort_order: 5 },
];

// Cột `settings.value` trong Supabase có kiểu TEXT. Vì vậy mọi giá trị dạng object/array
// (thư mục Google Drive, map kế hoạch tiết kiệm...) PHẢI được stringify khi ghi và parse
// khi đọc; nếu ghi thẳng object, Supabase báo lỗi kiểu dữ liệu và giá trị không được lưu
// → mất sau khi reload trang. Các giá trị chuỗi/số (last_updated_at, category_seed_version...)
// được giữ nguyên.
function serializeSettingValue(item) {
  if (item && item.value !== null && item.value !== undefined && typeof item.value === 'object') {
    return { ...item, value: JSON.stringify(item.value) };
  }
  return item;
}

function deserializeSettingRow(row) {
  if (row && typeof row.value === 'string') {
    const v = row.value.trim();
    if (v.startsWith('{') || v.startsWith('[')) {
      try {
        return { ...row, value: JSON.parse(row.value) };
      } catch {
        // Không phải JSON hợp lệ → giữ nguyên chuỗi gốc.
      }
    }
  }
  return row;
}

// Các cột số (numeric/integer) trong Supabase được PostgREST trả về dưới dạng CHUỖI
// (numeric được serialize thành string để bảo toàn precision). Thời còn dùng Dexie/IndexedDB
// chúng là number, nên nhiều phép tính giả định number — đặc biệt cộng/trừ số dư tài khoản
// (`balance + diff`). Nếu giữ nguyên chuỗi, toán tử `+` sẽ NỐI CHUỖI thay vì cộng số
// (vd "1000000" + 50000 → "100000050000") khiến số dư tài khoản sai sau mỗi giao dịch.
// → Ép các cột này về Number ngay khi đọc để khôi phục hành vi cũ.
const NUMERIC_FIELDS = {
  accounts: ['balance'],
  transactions: ['amount', 'loan_principal_amount', 'balance_after_source', 'balance_after_dest'],
  loans: ['total_amount', 'interest_rate', 'term_months', 'minimum_payment', 'payment_date', 'next_payment_amount', 'remaining_principal', 'principal_amount'],
  budgets: ['amount'],
  investments: ['buy_price', 'quantity', 'current_price', 'initial_amount', 'interest_rate', 'return_rate', 'loan_amount'],
  savings: ['principal_amount', 'interest_rate', 'term_months'],
  goals: ['target_amount', 'current_amount'],
};

function coerceNumericFields(tableName, row) {
  if (!row) return row;
  const fields = NUMERIC_FIELDS[tableName];
  if (!fields) return row;
  let out = null;
  for (const f of fields) {
    const val = row[f];
    if (val !== null && val !== undefined && val !== '' && typeof val !== 'number') {
      const n = Number(val);
      if (!Number.isNaN(n)) {
        if (!out) out = { ...row };
        out[f] = n;
      }
    }
  }
  return out || row;
}

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
    if (this.tableName === 'settings') return (data || []).map(deserializeSettingRow);
    return (data || []).map(row => coerceNumericFields(this.tableName, row));
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
    if (this.tableName === 'settings') return data ? deserializeSettingRow(data) : null;
    return data ? coerceNumericFields(this.tableName, data) : null;
  }

  async add(item) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Not authenticated');

    const payload = this.tableName === 'settings' ? serializeSettingValue(item) : item;
    const record = { ...payload, user_id: user.id };
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(record)
      .select()
      .single();
    if (error) {
      console.error(`Error adding to ${this.tableName}:`, error);
      throw error;
    }
    if (this.tableName !== 'settings') touchLastModified();
    return data;
  }

  async put(item) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Not authenticated');

    const payload = this.tableName === 'settings' ? serializeSettingValue(item) : item;
    const record = { ...payload, user_id: user.id };

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
    if (this.tableName !== 'settings') touchLastModified();
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
    if (this.tableName !== 'settings') touchLastModified();
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
    if (this.tableName !== 'settings') touchLastModified();
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
    if (this.tableName !== 'settings') touchLastModified();
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
    if (this.tableName !== 'settings') touchLastModified();
    return data || [];
  }

  filter(fn) {
    const self = this;
    return {
      toArray: async () => {
        const all = await self.toArray();
        return all.filter(fn);
      },
      // Tương thích Dexie: AddBudgetSheet/EditBudgetSheet dùng `.filter(...).first()`
      // để lấy bản ghi đầu tiên khớp (vd ngân sách trùng category_id + month).
      first: async () => {
        const all = await self.toArray();
        return all.find(fn) ?? null;
      }
    };
  }

  // Chain kiểu Dexie: hỗ trợ reverse/filter/offset/limit gọi theo BẤT KỲ thứ tự nào,
  // mọi method đều trả về cùng `chain` rồi kết thúc bằng toArray(). Trước đây `filter()`
  // trả về object chỉ có toArray (mất offset/limit) và chain hoàn toàn thiếu `offset`,
  // khiến TransactionsList gọi `.filter(...).offset(...).limit(...)` ném TypeError và
  // danh sách giao dịch rỗng. Thứ tự áp dụng cố định: sort → filter → offset → limit.
  orderBy(field) {
    const self = this;
    const state = { ascending: true, limitCount: Infinity, offsetCount: 0, filters: [] };
    const chain = {
      reverse() {
        state.ascending = false;
        return chain;
      },
      limit(n) {
        state.limitCount = n;
        return chain;
      },
      offset(n) {
        state.offsetCount = n;
        return chain;
      },
      filter(fn) {
        state.filters.push(fn);
        return chain;
      },
      async toArray() {
        let all = await self.toArray();
        all.sort((a, b) => {
          const va = a[field] ?? '';
          const vb = b[field] ?? '';
          if (va < vb) return state.ascending ? -1 : 1;
          if (va > vb) return state.ascending ? 1 : -1;
          return 0;
        });
        for (const fn of state.filters) all = all.filter(fn);
        const start = state.offsetCount;
        const end = state.limitCount < Infinity ? start + state.limitCount : undefined;
        return all.slice(start, end);
      }
    };
    return chain;
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
  goals: new SupabaseTableWrapper('goals'),
  notes: new SupabaseTableWrapper('notes')
};

export async function updateLastModified() {
  try {
    const now = new Date().toISOString();
    await db.settings.put({ key: 'last_updated_at', value: now });
  } catch (err) {
    console.error('Failed to update last_updated_at on Supabase:', err);
  }
}

// Trigger có debounce để ghi nhận "thời gian cập nhật gần nhất" mỗi khi DỮ LIỆU thay đổi.
// Được gọi tự động từ các phương thức ghi của SupabaseTableWrapper (trừ bảng 'settings'
// để tránh đệ quy vô hạn). Gộp nhiều thay đổi liên tiếp (cập nhật số dư nhiều tài khoản,
// seed danh mục, khôi phục backup...) thành 1 lần ghi để tránh spam Supabase.
let _touchTimer = null;
export function touchLastModified() {
  if (_touchTimer) clearTimeout(_touchTimer);
  _touchTimer = setTimeout(() => {
    _touchTimer = null;
    updateLastModified();
  }, 1200);
}

// Tăng số này mỗi khi thay đổi bộ DEFAULT_CATEGORIES để kích hoạt đồng bộ lại cho mọi tài khoản.
export const CATEGORY_SEED_VERSION = '5';

// Cờ chống chạy đồng thời (onAuthStateChange + getInitialSession có thể gọi song song).
let seedingInProgress = false;

// Khóa gom nhóm không phân biệt hoa/thường + khoảng trắng thừa, để gộp các biến thể
// như "sinh hoạt" / "Sinh hoạt" về cùng một danh mục.
const catKey = (type, name) => `${type}|${(name || '').trim().toLowerCase()}`;

export async function seedDefaultData() {
  // BẮT BUỘC phải có phiên đăng nhập. Nếu chạy khi chưa có session, db.categories.toArray()
  // trả về [] trong khi add() lại chèn được → gây nhân đôi danh mục và không dọn được bản cũ.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  if (seedingInProgress) return;
  seedingInProgress = true;
  try {
    const versionRow = await db.settings.get('category_seed_version');
    if (versionRow && versionRow.value === CATEGORY_SEED_VERSION) return;

    const all = await db.categories.toArray();

    // Gom danh mục hiện có theo khóa chuẩn hóa để phát hiện và dọn bản trùng lặp.
    const groups = new Map();
    for (const c of all) {
      const key = catKey(c.type, c.name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }

    // 1. Upsert danh mục mặc định: giữ 1 bản (giữ nguyên id để không mất tham chiếu
    //    category_id ở giao dịch/ngân sách), chuẩn hóa lại tên/icon, xóa các bản trùng còn lại.
    // Bọc try/catch từng danh mục: nếu một danh mục lỗi (vd CHECK constraint trên cột type),
    // các danh mục còn lại vẫn được seed thay vì dừng giữa chừng và bỏ trống cả nhóm.
    let seedFailures = 0;
    for (const c of DEFAULT_CATEGORIES) {
      const key = catKey(c.type, c.name);
      const dups = groups.get(key) || [];
      const fields = {
        name: c.name,
        icon: c.icon,
        color_hex: c.color_hex,
        sort_order: c.sort_order,
        is_ui_default: c.is_ui_default || false,
        is_default: true,
      };
      try {
        if (dups.length === 0) {
          await db.categories.add({ id: crypto.randomUUID(), type: c.type, ...fields });
        } else {
          await db.categories.update(dups[0].id, fields);
          for (let i = 1; i < dups.length; i++) {
            await db.categories.delete(dups[i].id);
          }
        }
      } catch (err) {
        seedFailures++;
        console.error(`Failed to seed category "${c.type}/${c.name}":`, err);
      }
      groups.delete(key);
    }

    // 2. Xóa danh mục MẶC ĐỊNH cũ không còn trong danh sách mới (chỉ is_default = true;
    //    giữ lại danh mục do người dùng tự tạo). Cũng dọn bản trùng cùng tên nếu có.
    for (const [, list] of groups) {
      for (const c of list) {
        if (c.is_default) {
          await db.categories.delete(c.id);
        }
      }
    }

    // Chỉ đánh dấu version đã seed xong khi KHÔNG có danh mục nào lỗi. Nếu còn lỗi,
    // không ghi version để lần khởi động sau seedDefaultData() tự thử lại (vd sau khi
    // đã sửa CHECK constraint trên DB cho cột type).
    if (seedFailures === 0) {
      await db.settings.put({ key: 'category_seed_version', value: CATEGORY_SEED_VERSION });
    }
  } catch (err) {
    console.error('Failed to seed default categories on Supabase:', err);
  } finally {
    seedingInProgress = false;
  }
}
