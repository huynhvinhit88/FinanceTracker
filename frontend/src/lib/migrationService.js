import Dexie from 'dexie';
import { supabase } from './supabaseClient';

export async function migrateLocalDataToSupabase() {
  const { data: { session } } = await supabase.auth.getSession();
  const sessionUser = session?.user;
  if (!sessionUser) return;

  const dbName = 'FinanceTrackerDB';
  const exists = await Dexie.exists(dbName);
  if (!exists) {
    console.log('No local IndexedDB database found. Skipping migration.');
    return;
  }

  console.log('Local database found. Initiating migration to Supabase...');
  const localDb = new Dexie(dbName);
  
  localDb.version(3).stores({
    settings: 'key, value',
    accounts: 'id, name, type, sub_type, balance, currency, icon, color_hex, is_default, include_in_net_worth, status',
    categories: 'id, name, type, icon, color_hex, parent_id, is_default, is_ui_default, sort_order',
    transactions: 'id, account_id, category_id, amount, date, type, note, tags',
    loans: 'id, account_id, name, total_amount, interest_rate, term_months, start_date, type, status, minimum_payment, payment_date, interest_type, next_payment_amount',
    budgets: 'id, category_id, amount, month, type',
    investments: 'id, account_id, symbol, name, type, buy_price, quantity, purchase_date, current_price, initial_amount, maturity_date, interest_rate, interest_type, auto_renew, status, return_rate, loan_amount',
    savings: 'id, account_id, category_id, name, principal_amount, interest_rate, term_months, term_unit, start_date, maturity_date, interest_type, auto_renew, status',
    goals: 'id, name, target_amount, current_amount, deadline, icon, color_hex, status'
  });

  try {
    await localDb.open();
    
    // List of tables to migrate
    const tables = ['accounts', 'categories', 'transactions', 'loans', 'budgets', 'investments', 'savings', 'goals', 'settings'];

    for (const table of tables) {
      const records = await localDb.table(table).toArray();
      if (records && records.length > 0) {
        const recordsToInsert = records.map(record => {
          const formatted = { ...record, user_id: sessionUser.id };
          if (table === 'settings' && formatted.key === 'appLockPin') return null;
          return formatted;
        }).filter(Boolean);

        if (recordsToInsert.length > 0) {
          // Perform insert
          const { error } = await supabase.from(table).upsert(recordsToInsert);
          if (error) {
            console.error(`Error migrating table ${table}:`, error);
          } else {
            console.log(`Successfully migrated ${recordsToInsert.length} records to ${table} table.`);
          }
        }
      }
    }

    // Migrate guest local storage settings if present
    const guestLoanProfiles = localStorage.getItem('loan_profiles_guest');
    if (guestLoanProfiles) {
      localStorage.setItem(`loan_profiles_${sessionUser.id}`, guestLoanProfiles);
      localStorage.removeItem('loan_profiles_guest');
    }
    const guestSavingsPlan = localStorage.getItem('savings_plan_guest');
    if (guestSavingsPlan) {
      localStorage.setItem(`savings_plan_${sessionUser.id}`, guestSavingsPlan);
      localStorage.removeItem('savings_plan_guest');
    }

    // Delete Dexie database upon successful migration
    await localDb.delete();
    console.log('Dexie local database deleted after successful migration.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}
