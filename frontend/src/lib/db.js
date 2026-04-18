import Dexie from 'dexie';

// Yêu cầu Persistent Storage để tránh trình duyệt tự xóa DB khi thiếu bộ nhớ
async function persistStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      await navigator.storage.persist();
    }
  }
}

persistStorage().catch(console.error);

export const db = new Dexie('FinanceTrackerDB');

db.version(1).stores({
  settings: 'key, value',
  accounts: 'id, name, type, sub_type, balance, currency, icon, color_hex, is_default, include_in_net_worth, status',
  categories: 'id, name, type, icon, color_hex, parent_id, is_default',
  transactions: 'id, account_id, category_id, amount, date, type, note, tags',
  loans: 'id, account_id, name, total_amount, interest_rate, term_months, start_date, type, status, minimum_payment, payment_date, interest_type, next_payment_amount',
  budgets: 'id, category_id, amount, month, type',
  investments: 'id, account_id, symbol, name, type, buy_price, quantity, purchase_date, current_price, initial_amount, maturity_date, interest_rate, interest_type, auto_renew, status, return_rate, loan_amount',
  savings: 'id, account_id, name, principal_amount, interest_rate, term_months, term_unit, start_date, maturity_date, interest_type, auto_renew, status',
  goals: 'id, name, target_amount, current_amount, deadline, icon, color_hex, status'
});

db.version(2).stores({}).upgrade(async (tx) => {
  // Migration: Update 'Phải thu' sub_type from 'debt' to 'receivable'
  await tx.table('accounts')
    .filter(acc => acc.type === 'Phải thu' && acc.sub_type === 'debt')
    .modify({ sub_type: 'receivable' });
});

db.version(3).stores({
  savings: 'id, account_id, category_id, name, principal_amount, interest_rate, term_months, term_unit, start_date, maturity_date, interest_type, auto_renew, status',
});

db.version(4).stores({}).upgrade(async (tx) => {
  const categoriesToRemove = ['Ăn uống', 'Di chuyển', 'Mua sắm', 'Hóa đơn'];
  await tx.table('categories')
    .filter(cat => categoriesToRemove.includes(cat.name) && cat.is_default === true)
    .delete();
});

export const DEFAULT_CATEGORIES = [
  { name: 'Trả nợ vay', type: 'expense', icon: '🏦', color_hex: '#EF4444' },
  { name: 'Chi hộ', type: 'expense', icon: '🤝', color_hex: '#EF4444' },
  { name: 'Lương', type: 'income', icon: '💰', color_hex: '#10B981' },
  { name: 'Thưởng', type: 'income', icon: '🎁', color_hex: '#F59E0B' },
  { name: 'Thu hộ', type: 'income', icon: '🤝', color_hex: '#10B981' },
  { name: 'Thu hồi nợ', type: 'income', icon: '💰', color_hex: '#10B981' },
  { name: 'Khác', type: 'transfer', icon: '🔄', color_hex: '#6B7280' },
];

export async function seedDefaultData() {
  const seeded = await db.settings.get('has_seeded_categories');
  if (seeded && seeded.value) return;

  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map(c => ({
      ...c,
      id: crypto.randomUUID(),
      is_default: true
    })));
  }
  await db.settings.put({ key: 'has_seeded_categories', value: true });
}
