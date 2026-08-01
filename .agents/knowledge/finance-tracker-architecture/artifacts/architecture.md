# FinanceTracker — Project Architecture & Tech Stack

> **⚠️ MIGRATION NOTICE (IndexedDB → Supabase):** The data layer was migrated from **Dexie/IndexedDB** to **Supabase (PostgreSQL + Auth + RLS)**. Auth changed from a **local PIN** to **Supabase email/password**. Much of the older documentation referencing "local-first, NO Supabase" and "PIN auth" is now obsolete — this file reflects the post-migration state.

## Quick Reference
- **Frontend root**: `frontend/`
- **Entry point**: `frontend/src/main.jsx` → `App.jsx`
- **Local dev**: `npm install --legacy-peer-deps` then `npm run dev` (Vite). `--legacy-peer-deps` is required because `vite-plugin-pwa@0.21` does not yet declare peer support for Vite 8.
- **Required env vars** (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID` (Drive backup only).

---

## Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | React | ^19 | Functional + hooks |
| Build | Vite | ^8 | Dev server (needs `--legacy-peer-deps` on install) |
| CSS | Tailwind CSS | **v4** | `@import "tailwindcss"` in `index.css` — NO `tailwind.config.js`! |
| Dark Mode | Tailwind `dark:` | — | Class-based via `.dark` on `<html>`. Requires `@custom-variant dark (&:where(.dark, .dark *));` in `index.css` |
| Animation | Framer Motion | ^12 | Used in `BottomSheet`, transitions |
| Icons | lucide-react | ^1.7 | Consistent icon library |
| **Database & Auth** | **Supabase** (`@supabase/supabase-js`) | ^2 | **PostgreSQL + Auth + Row Level Security**. Replaces Dexie. |
| Legacy/Migration | Dexie.js | ^4 | **Only** used by `migrationService.js` to read & migrate an old local IndexedDB DB on first login, then delete it |
| State | Zustand | ^5 | Lightweight global state |
| Data fetching | @tanstack/react-query | ^5 | Query/cache layer |
| Routing | React Router | ^7 | `BrowserRouter` with nested routes |
| Charts | Recharts | ^3 | `BarChart`, `PieChart`, `AreaChart` |
| Spreadsheet | xlsx | ^0.18 | CSV/Excel export |
| PWA | vite-plugin-pwa | ^0.21 | Service worker / installable |

---

## Directory Structure

```
frontend/src/
├── App.jsx                    # Root: ThemeProvider > AuthProvider > BrowserRouter; calls seedDefaultData()
├── index.css                  # Tailwind v4: @import + @custom-variant dark
├── main.jsx                   # ReactDOM.createRoot
├── contexts/
│   ├── AuthContext.jsx         # Supabase Auth (email/password). user = Supabase user object | null
│   └── ThemeContext.jsx        # Dark/light theme — persists to localStorage
├── hooks/
│   ├── useCurrencyInput.js     # Currency input with shortcut mode (x1000); allowNegative option for signed balances (debt accounts)
│   ├── useGlobalRefresh.js     # Event 'ft:data-changed' + emitDataChanged() + useGlobalRefresh(cb) — các page tự fetch lại sau khi thêm giao dịch từ FAB toàn cục
│   └── useLoans.js             # Loan CRUD + updateLoanBalance + getLoanTransactions + suggestInterest
├── lib/
│   ├── supabaseClient.js       # createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
│   ├── db.js                   # SupabaseTableWrapper — Dexie-style API over Supabase tables; seedDefaultData, updateLastModified + touchLastModified (auto on every non-settings write); JSON (de)serialize for the TEXT settings.value column; coerceNumericFields on read (numeric cols come back as strings from PostgREST → cast to Number so JS math doesn't string-concat)
│   ├── localHandleStore.js     # Local IndexedDB (Dexie) for non-serializable, device-local data — FileSystemDirectoryHandle (backup folder)
│   ├── migrationService.js     # One-time IndexedDB (Dexie) → Supabase migration on first login
│   └── syncService.js          # Google Drive backup/restore + JSON/CSV export (manual); Dexie-format backward compat
├── utils/
│   ├── format.js               # formatCurrency (vi-VN), toViDecimal/fromViDecimal, parse helpers
│   └── loanCalculator.js       # calculateLoanSchedule — amortization + early-payoff simulation
├── pages/
│   ├── Home.jsx                # Dashboard — net worth, spending pie, recent transactions (nút "+" thêm giao dịch nay là FAB toàn cục ở AppLayout)
│   ├── Accounts.jsx            # 4 tabs (Cash / Savings / Investment / Loans). The Savings tab also hosts the savings analysis (cơ cấu theo hạng mục/tài khoản + lịch trình đáo hạn, placed above the savings books list), moved here from Statistics
│   ├── Plan.jsx                # Budget planning (default & monthly modes) + long-range net-worth projection
│   ├── Statistics.jsx          # Income/expense charts, Thu hộ/Chi hộ reconciliation (savings analysis was moved to the Accounts → Savings tab)
│   ├── Settings.jsx            # Tools, category mgmt, Google Drive, export, wipe, dark mode, change password, sign out
│   ├── TransactionsList.jsx    # Full scrollable transaction history with type/time/account filters (account filter matches source OR destination on transfers)
│   └── auth/Login.jsx          # Supabase email/password sign-in & sign-up
└── components/
    ├── layout/
    │   ├── AppLayout.jsx     # 3-column responsive: SidebarNav (L) + content (C) + DesktopWidgets (R); BottomTabBar on mobile; gắn GlobalAddTransactionFab
    │   ├── GlobalAddTransactionFab.jsx # Nút "+" FAB toàn cục mở AddTransactionSheet; thêm thành công → emitDataChanged()
    │   ├── SidebarNav.jsx    # Desktop-only left sidebar navigation
    │   ├── DesktopWidgets.jsx# Desktop-only right widgets panel
    │   ├── BottomTabBar.jsx  # Mobile 5-tab nav: Tổng quan / Tài khoản / Kế hoạch / Thống kê / Cài đặt
    │   └── ProtectedRoute.jsx# Guards — redirects to /login if user is null
    ├── ui/
    │   └── BottomSheet.jsx   # Base modal sheet (Framer Motion spring animation)
    ├── transactions/
    │   ├── AddTransactionSheet.jsx   # income/expense/transfer + loan repayment; updates account balances client-side
    │   └── EditTransactionSheet.jsx  # Edit/delete transaction (rollback + reapply balances)
    ├── accounts/
    │   ├── AddAccountSheet.jsx       # Add account with type selection
    │   └── EditAccountSheet.jsx      # Edit account
    ├── wealth/
    │   ├── AddSavingsSheet.jsx / EditSavingsSheet.jsx       # Savings books
    │   └── AddInvestmentSheet.jsx / EditInvestmentSheet.jsx # Investments (gold, crypto, stock, real estate…)
    ├── loans/
    │   ├── AddLoanSheet.jsx          # Add loan (promo/floating rate, periods, prepayment plan)
    │   └── LoanDetailSheet.jsx       # View/edit loan + amortization schedule
    ├── budgets/
    │   ├── AddBudgetSheet.jsx / EditBudgetSheet.jsx
    ├── goals/
    │   ├── AddGoalSheet.jsx / FundGoalSheet.jsx
    ├── settings/
    │   ├── CategoryManagementSheet.jsx
    │   ├── ChangePasswordSheet.jsx   # Change Supabase password (verify current → updateUser)
    │   ├── DriveFilePicker.jsx        # Pick a backup file from Google Drive
    │   └── DriveFolderPicker.jsx      # Pick a Drive folder for backups
    └── tools/
        ├── LoanCalculatorSheet.jsx    # Loan calculator/simulator (saved profiles in localStorage)
        └── CompoundInterestSheet.jsx  # Compound interest tool
```

---

## App Routing (`App.jsx`)

```
/login            → <Login />  (Standalone, no nav)
/                 → <AppLayout> (ProtectedRoute)
  /               → <Home />
  /accounts       → <Accounts />
  /plan           → <Plan />
  /statistics     → <Statistics />
  /settings       → <Settings />
/transactions     → <TransactionsList /> (Standalone, no bottom tab)
*                 → redirect to /
```
`App.jsx` runs `seedDefaultData()` once on mount to insert default categories for the signed-in user.

---

## Contexts

### `AuthContext` (Supabase Auth)
- **Cloud accounts via Supabase**. `user` is the Supabase user object (or `null` when signed out).
- On initial session and on `SIGNED_IN`/`INITIAL_SESSION`, calls `initUserData()` → `seedDefaultData()` then `processAutoRenewals()` (`lib/savingsService.js` — auto-renew matured savings books on app open). Seeding lives here (NOT in `App.jsx`) so it only runs once a session is confirmed — otherwise `db.categories.toArray()` returns `[]` while `add()` still inserts, duplicating categories.
- Key functions: `signUp(email, password)`, `signIn(email, password)`, `signOut()`, `updatePassword(currentPassword, newPassword)` (verifies current via `signInWithPassword`, then `supabase.auth.updateUser({ password })`).
- Sign-up requires **email confirmation** before use.
- Use `const { user, loading } = useAuth()`. `ProtectedRoute` redirects to `/login` when `user === null`.
- **No Google OAuth login** — Google is used only for Drive backup (`syncService.js`).

### `ThemeContext`
- Reads/writes `localStorage.getItem('theme')` → `'dark'` or `'light'`.
- On change: adds/removes `.dark` class on `document.documentElement`.
- **CRITICAL**: Tailwind v4 dark mode only works with `@custom-variant dark (&:where(.dark, .dark *));` in `index.css`.
- Use `const { theme, toggleTheme } = useTheme()`.

---

## Data Layer (`lib/db.js` — SupabaseTableWrapper)

`db.js` exports a `db` object whose tables are instances of `SupabaseTableWrapper`, exposing a **Dexie-compatible API** over Supabase so legacy call sites keep working:

- `toArray()`, `get(idOrQuery)`, `add(item)`, `put(item)` (upsert), `update(id, updates)`, `delete(id)`, `clear()`, `bulkAdd(items)`, `count()`.
- Chainable `orderBy(field).reverse().filter(fn).offset(n).limit(n).toArray()` and `filter(fn).toArray()` — sorting/filtering/paging happen **in JS after fetching** (not pushed down to SQL). Trên `orderBy`, các method `reverse/filter/offset/limit` gọi được theo **bất kỳ thứ tự** nào (mọi method trả về cùng chain); thứ tự áp dụng cố định là sort → filter → offset → limit. `offset(n)` cần cho phân trang vô hạn của `TransactionsList`.
- Every call scopes to the current user via `user_id` (or `key` for `settings`), and inserts auto-attach `user_id`. RLS enforces this server-side too.

```
db.settings | db.accounts | db.categories | db.transactions | db.loans
db.budgets  | db.investments | db.savings  | db.goals
```

Helpers: `seedDefaultData()` (**versioned reseed** — re-runs when `settings.category_seed_version` ≠ `CATEGORY_SEED_VERSION`; **guards: requires an active session + an in-memory `seedingInProgress` flag against concurrent calls**; groups existing categories by `type|name`, upserts each default into the first match keeping its id and deleting duplicate copies, then deletes leftover `is_default` categories not in the list), `updateLastModified()` (writes `settings.last_updated_at` immediately), `touchLastModified()` (**debounced 1.2s trigger called automatically inside every mutating wrapper method — add/put/update/delete/bulkAdd/clear — for all tables EXCEPT `settings`, so any real data change bumps the timestamp without recursion**; explicit `updateLastModified()` is still called after restore/sync and from the loan calculator), `DEFAULT_CATEGORIES` (expense + income + savings groups; one per group marked `is_ui_default`), `CATEGORY_SEED_VERSION`.

> **`settings.value` is a TEXT column.** Object/array settings (`googleDriveFolder`, Plan.jsx `expected_total_savings_map_*` / `savings_plan_map_*`) must be JSON-(de)serialized — done centrally in the wrapper (`serializeSettingValue` on add/put, `deserializeSettingRow` on get/toArray, settings table only; only strings starting with `{`/`[` are parsed, so plain-string settings stay intact). Writing a raw object made Supabase reject the row → the Drive folder selection silently failed to save and was lost (`undefined`) on reload.

> **Device-local handles (`localHandleStore.js`):** the backup folder `FileSystemDirectoryHandle` is **structured-cloneable but NOT JSON-serializable**, so it is stored in a separate local Dexie/IndexedDB database (`finance_tracker_local`, store `handles`) — NOT in Supabase. Storing it via `db.settings.put` previously serialized it to `{}`, so the folder was lost (`undefined`) on every reload. `selectDirectoryHandle()` saves via `saveLocalHandle()`; `Settings.loadDirectoryHandle()` restores via `getLocalHandle()`. Handles are inherently per-device, so they are never synced or backed up.

---

## Database Schema (Supabase / PostgreSQL)

Schema files live at repo root: `supabase_schema.sql` → `supabase_schema_v6_full_auth.sql`. RLS policy on every table: `auth.uid() = user_id` (profiles: `auth.uid() = id`).

```
profiles:     id (=auth.users.id), display_name, currency, created_at
accounts:     id, user_id, name, type, sub_type, balance, currency, icon, color_hex, is_default, include_in_net_worth, status, created_at
categories:   id, user_id, name, type(income|expense|transfer|savings), icon, color_hex, parent_id, is_default, is_ui_default, sort_order, created_at  -- 'savings' = danh mục Chuyển khoản; CHECK phải gồm 'savings' (ALTER thủ công nếu DB tạo từ schema cũ — supabase_schema_v7)
transactions: id, user_id, account_id, category_id, to_account_id, amount, type(income|expense|transfer), date, note, tags, created_at
loans:        id, user_id, account_id, name, total_amount, interest_rate, term_months, start_date, type(borrow|lend), status, minimum_payment, payment_date, interest_type, next_payment_amount, created_at
budgets:      id, user_id, category_id, amount, month('YYYY-MM'|null), type, created_at  [unique (user_id, category_id, month)]
investments:  id, user_id, account_id, symbol, name, type, buy_price, quantity, purchase_date, current_price, initial_amount, maturity_date, interest_rate, interest_type, auto_renew, status, return_rate, loan_amount, created_at
savings:      id, user_id, account_id, category_id, name, principal_amount, interest_rate, term_months, term_unit, start_date, maturity_date, interest_type, auto_renew, auto_renew_compound, status, created_at  -- auto_renew[_compound]: tái tục tự động khi mở app (lib/savingsService.processAutoRenewals); chạy v9 nếu DB thiếu cột
goals:        id, user_id, name, target_amount, current_amount, deadline, icon, color_hex, status, created_at
settings:     (key, user_id) PK, value
```

### ⚠️ SQL ↔ Code drift (IMPORTANT — verify before re-running any schema file)
The committed `supabase_schema_v6_full_auth.sql` is **out of sync** with the running code:

1. **Missing columns.** Code reads/writes columns the v6 file does not create:
   - `transactions.loan_id`, `transactions.loan_payment_type`, `transactions.loan_principal_amount`
   - `loans.remaining_principal`, `loans.linked_investment_id`, `loans.promo_rate`, `loans.promo_months`, `loans.base_rate`, `loans.margin_rate`, `loans.penalty_config`, `loans.first_payment_date`, `loans.extra_payment`, `loans.offset_threshold`, `loans.periods`
   - The live DB must have been `ALTER TABLE`-d by hand to add these (not captured in any repo SQL file).
2. **Balance trigger conflict.** v6 defines a `process_transaction()` trigger that updates `accounts.balance` server-side, **but the client also updates balances** (`AddTransactionSheet.updateAccountBalances`). If both ran, balances would **double-count** — so the live DB almost certainly does NOT have this trigger enabled.

**Recommendation:** Re-running `v6` as-is on the live DB would drop tables and reintroduce the conflicting trigger / drop the hand-added columns. Treat the SQL files as historical; reconcile into a single source-of-truth schema before any reset.

---

## Key Hooks

### `useCurrencyInput(initialValue, { useShortcut })`
- Returns `{ displayValue, value, handleInputChange, reset, setExternalValue, suffix }`
- **Shortcut mode ON**: Input `"50"` → stored as `50000`. Suffix = `".000 ₫"`.
- **Shortcut mode OFF** (default): Input `"50000"` → stored as `50000`. Suffix = `" ₫"`.
- Always use `value` (not `displayValue`) when saving to DB.

### `useLoans()`
- Returns `{ loans, loading, fetchLoans, addLoan, updateLoan, deleteLoan, updateLoanBalance, suggestInterest, getLoanTransactions }`.
- `fetchLoans()` enriches each loan with `linked_investment` (looked up via `loan.linked_investment_id`).
- `updateLoanBalance(loanId, principalPaid)` — reduces `remaining_principal`, marks `paid_off` if ≤ 100, and reduces the linked `investments.loan_amount`.
- `getLoanTransactions(loanId)` — filters transactions by `loan_id`.
- `suggestInterest(loan)` — `remaining_principal * (interest_rate/100/12)`.
- (Relies on the hand-added loan/transaction columns noted in the drift section above.)
