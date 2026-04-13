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
  settings: 'key, value', // appLockPin, driveSyncEnabled, etc.
  accounts: 'id, name, type, sub_type, balance, currency, icon, color_hex, is_default, include_in_net_worth, status',
  categories: 'id, name, type, icon, color_hex, parent_id, is_default',
  transactions: 'id, account_id, category_id, amount, date, type, note, tags',
  loans: 'id, account_id, name, total_amount, interest_rate, term_months, start_date, type, status, minimum_payment, payment_date, interest_type, next_payment_amount',
  budgets: 'id, category_id, amount, month, type',
  investments: 'id, account_id, symbol, name, type, buy_price, quantity, purchase_date, current_price, initial_amount, maturity_date, interest_rate, interest_type, auto_renew, status, return_rate, loan_amount',
  savings: 'id, account_id, name, principal_amount, interest_rate, term_months, term_unit, start_date, interest_type, auto_renew, status',
  goals: 'id, name, target_amount, current_amount, deadline, icon, color_hex, status'
});
