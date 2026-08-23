# FinanceTracker — Business Logic & Financial Calculations

> **⚠️ MIGRATION NOTICE (IndexedDB → Supabase):** Data now lives in **Supabase (PostgreSQL + RLS)**, accessed via the Dexie-style `SupabaseTableWrapper` in `lib/db.js`. The **financial formulas below are unchanged** by the migration, but two operational facts changed: (1) account balances are updated **client-side** per flow (the Supabase `process_transaction()` trigger in the v6 SQL file must NOT be active or balances double-count); (2) backups now export Supabase tables, not a Dexie blob. The old "DB version 2" migration note is a historical Dexie detail.

## Account Sub-Type Classification

The `sub_type` field on `accounts` drives ALL financial calculations. This is the most critical taxonomy:

| `sub_type` | Example accounts | Treatment in Net Worth |
|---|---|---|
| `'payment'` | Ví/Cash, Ngân hàng, Ví điện tử | **Asset** — included in total assets |
| `'savings'` | Sổ tiết kiệm (via `savings` table) | **Asset** — tracked separately |
| `'receivable'` | Phải thu | **Asset** — included in total assets |
| `'debt'` | Thẻ tín dụng, Khoản nợ | **Real signed balance** — `balance` is the actual balance, **negative = owed**. Counted directly with other account balances (no separate liability subtraction). |

> **Debt balance model (updated):** A `debt` account's `balance` is its **real signed balance**, like any wallet. Spending from a card subtracts (goes negative); paying it back adds (toward 0). `updateAccountBalances` therefore treats debt **identically** to normal wallets — no sign inversion (`income → +amount`, `expense/transfer → −amount`, transfer destination `+amount`). In net worth, the (negative) debt balance is simply **added** with the other account balances, which naturally reduces net worth — it is NOT also added to the liabilities bucket (that would double-count). Editing a debt account that is currently in debt → enter a **negative** number (`useCurrencyInput({ allowNegative: true })`).

> **Historical note**: `Phải thu` accounts were once migrated from `sub_type: 'debt'` to `sub_type: 'receivable'` (old Dexie "DB version 2"). This is no longer an active migration step under Supabase, but the `receivable` sub_type remains the current convention.

---

## Net Worth Calculation (`Home.jsx`)

### Total Assets (Gross)
```
totalAssetsGross = totalCashAndReceivable + totalSavings + totalInvestmentMarketValue
```

**Detail:**
```js
// Cash + Banks + Receivables (all non-debt accounts)
totalCashAndReceivable = accounts
  .filter(acc => acc.sub_type !== 'debt')
  .reduce((sum, acc) => sum + (acc.balance || 0), 0)

// Active savings books (principal only — from savings table, NOT accounts table)
totalSavings = savings
  .filter(s => s.status === 'active')
  .reduce((sum, s) => sum + (s.principal_amount || 0), 0)

// Investments: market value (GROSS — before deducting loan)
totalInvestmentMarketValue = investments
  .reduce((sum, inv) => {
    return sum + ((inv.current_price || 0) * (inv.type === 'real_estate' ? 1 : (inv.quantity || 1)))
  }, 0)
```

### Debt accounts (signed balance)
```js
// Debt sub_type accounts — balance is already NEGATIVE when owed
totalDebtAccounts = accounts
  .filter(acc => acc.sub_type === 'debt')
  .reduce((sum, acc) => sum + (acc.balance || 0), 0)   // ≤ 0 when in debt
```

### Total Liabilities
```
totalAllLiabilities = activeLoans + unlinkedInvestmentDebts
```
> Debt accounts are **NOT** in this bucket anymore — their negative balance is added directly in net worth (see below).

```js
// Active loan records (remaining_principal, NOT total_amount)
activeLoans = loans
  .filter(l => l.status === 'active')
  .reduce((sum, l) => sum + (l.remaining_principal || l.total_amount || 0), 0)

// Investment debts that do NOT have a linked loan (to avoid double counting)
unlinkedInvestmentDebts = investments
  .filter(inv => !loans.some(l => l.linked_investment_id === inv.id) && inv.loan_amount > 0)
  .reduce((sum, inv) => sum + inv.loan_amount, 0)
```

### Global Net Worth
```
globalNetWorth = totalAssetsGross + totalDebtAccounts - totalAllLiabilities
```
> `totalDebtAccounts` is ≤ 0, so adding it subtracts the debt. (`Plan.jsx`/`Settings.jsx` simply sum ALL account balances directly, including the negative debt ones.)

### Investment Net Value (for display)
```js
// ONLY used in the "Đầu tư" breakdown card — shows NET (market value - loan)
totalInvestmentsNet = investments.reduce((sum, inv) => {
  const marketVal = (inv.current_price || 0) * (inv.type === 'real_estate' ? 1 : (inv.quantity || 1))
  const debt = inv.loan_amount || 0
  return sum + (marketVal - debt)
}, 0)
```

---

## Transaction Types

The stored `transactions.type` is constrained to **`income | expense | transfer`** only. "Loan repayment" is a UI mode (`repayment`) that is **persisted as `type: 'expense'`** with extra loan columns set (`loan_id`, `loan_payment_type`, `loan_principal_amount`).

| UI type | Stored `type` | Effect on account `balance` (client-side, `updateAccountBalances`) |
|---|---|---|
| `'income'` | `income` | `+ amount` into the account (ALL sub_types, incl. debt) |
| `'expense'` | `expense` | `− amount` from the account (ALL sub_types — a debt account just goes more negative) |
| `'transfer'` | `transfer` | `− amount` from `account_id`, `+ amount` into `to_account_id` (no debt inversion) |
| `'repayment'` (loan) | `expense` | − from source wallet; sets `loan_id`/`loan_payment_type`/`loan_principal_amount`; loan balance reduced via `useLoans.updateLoanBalance(principalPaid)` |

> **Balances are updated in JS**, not by a DB trigger. `updateAccountBalances(payload, direction)` applies `direction = +1` on add and `direction = -1` to roll back on edit/delete. Do NOT also enable the `process_transaction()` SQL trigger (v6 file) — it would double-count. Run `supabase_schema_v10_disable_balance_trigger.sql` to drop that trigger from the DB.
>
> **Balance after transaction columns (Migration V14)**:
> Table `transactions` contains optional columns `balance_after_source` (numeric) and `balance_after_dest` (numeric). When a new transaction is created, the system snapshot-calculates `balance_after_source = account.balance (+/-) amount` (and `balance_after_dest = to_account.balance + amount` for transfers) and persists it directly to DB. Existing historical transactions continue to fallback gracefully to current account balance. Editing/deleting a transaction does not trigger recalculation of existing historical balance_after columns.

**`category_id` on transfers**: As of the latest update, transfer transactions **CAN have a `category_id`**. When present, the transfer amount is **included in category-based spending statistics** (Statistics page, pie chart, and monthly detail). Transfers without `category_id` are excluded from category stats. This enables use-cases like tracking monthly savings deposits ("Gửi tiết kiệm") as a categorized expense in reports.

**Overdraft protection**: Expenses, transfers, and loan repayments are blocked if `account.balance < amount`. Exception: accounts with `sub_type === 'debt'` (credit cards) are exempt from this check.

---

## Loan Repayment Logic (`useLoans.updateLoanBalance`)

When a loan repayment transaction is processed:
1. `principalPaid` is the **explicit principal portion** entered by user (NOT total payment amount).
2. `loan.remaining_principal -= principalPaid`
3. If `remaining_principal <= 100` → set `status = 'paid_off'`
4. If loan has `linked_investment_id` → also reduce `investment.loan_amount` by `principalPaid`

```js
// Monthly interest suggestion
suggestInterest(loan) = Math.round(loan.remaining_principal * (loan.interest_rate / 100 / 12))
```

### Self-Correcting Schedule Algorithm
The `calculateLoanSchedule` utility employs a hybrid historical-simulation approach to prevent inaccurate historical projections:
1. **Past Periods**: Uses `loan.principal_amount` as the initial term. It fetches matching actual repayment transactions (from `db.transactions`) to accurately reduce the simulated balance just as it happened in reality. Automated prepayments (budget-based offsets) are **BLOCKED** for past periods to prevent hallucinatory data.
2. **Transition Point**: At the current month, if the simulated remaining balance diverges from `loan.remaining_principal` (e.g., due to missing historical entries before using the app), it forces a self-correction (`adjustment`) so the projection snaps back to real data.
3. **Future Periods**: Continues the standard simulation cleanly using the exact updated `loan.remaining_principal`, including automated principal offsets if budget surplus exceeds the threshold.

### Payoff vs. Periodic Distinction (Bug Fix)
When processing historical transactions, the algorithm distinguishes between `loan_payment_type`:
- **`'payoff'`**: The **entire `loan_principal_amount`** is classified as `prepayThisMonth` (shown in "Tất toán" column). `principalThisMonth = 0`.
- **`'periodic'`** (default): Split between `principalThisMonth` (up to `basePrincipal`) and `prepayThisMonth` (excess).

> **Without this check**, a payoff of 100M in a loan with basePrincipal=100M would be misclassified as a normal monthly principal, causing 0 to appear in the "Tất toán" column and incorrect future projections.

---

## Savings Book Lifecycle

### 1. Opening a Savings Book (`AddSavingsSheet.jsx`)
When a new savings book is created, the system performs an atomic-like operation:
1. **Source Account Selection**: User must select a source account (non-debt types).
2. **Category Selection (optional)**: User can select a savings category (`type: 'savings'`) fetched from `db.categories`. Defaults to "-- Không phân loại --" (`category_id: null`).
3. **Balance Validation**: System blocks the creation if `account.balance < principal_amount`.
4. **Account Update**: `account.balance -= principal_amount`.
5. **Transaction Creation**: A new transaction of type **`'transfer'`** is created with `account_id`, `amount`, `date`, and `note` (`Mở sổ tiết kiệm: <name>`). **No `category_id` is set** on the transaction.
6. **Savings Record**: A new record is added to `db.savings` with `account_id`, **`category_id`**, `name`, `principal_amount`, `interest_rate`, `term_months`, `start_date`, `maturity_date`, and `status: 'active'`.

> **Savings categories** (`type: 'savings'`) are managed separately in Settings → Quản lý Danh mục → Tab **Tiết kiệm**. These categories are ONLY used for savings books, not transactions.

> **Workaround for statistics**: To track monthly savings deposits in category stats (transaction-based), users can create a **manual transfer transaction** with a savings-purpose category selected.

### 2. Settling a Savings Book (`EditSavingsSheet.jsx`)
When a savings book is settled, the user inputs the **Actual Interest** received, picks a Destination Account and Income Category, and chooses one of **three modes** (controlled by `isReinvesting` + `reinvestIncludeInterest`):

| Mode | `isReinvesting` / `reinvestIncludeInterest` | Amount credited to account (`receiveAmount`) | New savings book opened? |
|---|---|---|---|
| **Tất toán thường** | `false` / — | `principal + actualInterest` | No |
| **Tái tục chỉ gốc** | `true` / `false` | `actualInterest` only (interest taken as cash) | Yes, principal = **old principal** |
| **Tái tục gốc + lãi (lãi kép)** | `true` / `true` | `0` (nothing credited) | Yes, principal = **old principal + actualInterest** |

Common steps:
- If `receiveAmount > 0` → `destAccount.balance += receiveAmount`.
- **Principal transaction** (non-reinvest only): a `type: 'transfer'` tx categorized as "Tất toán sổ tiết kiệm" (auto-created savings category if missing), note `Nhận gốc tất toán: <name>`.
- **Interest income transaction**: `type: 'income'`, `amount: actualInterest`, created **only when `actualInterest > 0` AND interest is NOT folded into the new book** (i.e. skipped in the lãi-kép mode). Note `Lãi tái tục: <name>` (reinvest) or `Lãi tất toán: <name>` (settle).
- **New book on reinvest**: cloned with customizable `interest_rate` (defaults to old `interest_rate`) and customizable `maturity_date` (defaults to today + `term_months`), `start_date` set to today, name suffixed `(Tái tục)`, and `principal_amount` per the table above.
- Finally `db.savings.update(id, { status: 'settled' })` on the old book.

### 3. Auto-Renewal (`lib/savingsService.js` → `processAutoRenewals`)
Savings books can be opened/edited with `auto_renew` (and `auto_renew_compound`). Because the app is client-only (no background server), renewal is done by a **scan-on-app-open** strategy: `processAutoRenewals()` runs from `AuthContext.initUserData()` after each login (guarded by an `autoRenewInProgress` flag against the concurrent `getInitialSession` + `onAuthStateChange` calls).

For every `active` book with `auto_renew = true` and `maturity_date <= today`:
1. It loops over **each elapsed term** (handles multi-period overdue; capped at 600 iterations as a safety guard), computing the per-term interest with the standard formula `principal × rate% × (term_months / 12)`.
    - `auto_renew_compound = true` → interest is added to the new book's principal (compounding).
    - `auto_renew_compound = false` → interest is accumulated to be paid out as cash.
2. The old book is marked `status: 'settled'`.
3. A new `active` book is opened (same rate/term, `auto_renew` flags preserved), `start_date` = the maturity of the current in-force cycle, name suffixed `(Tái tục)`, `principal_amount` per the compound flag.
4. **Only when not compounding** and the source account exists: `account.balance += totalInterest` and an `income` transaction (note `Lãi tái tục tự động: <name>`, category = an income category whose name contains "lãi", else the first income category) is created.

> Auto-renewal uses the **projected** interest (rate × term), since no human enters the actual interest. Books with `term_months <= 0` are skipped to avoid an infinite loop.

### 4. Interest Calculation (for Plan projection)
```js
savAnnualInterest = activeSavings.reduce((s, x) => {
  return s + ((x.principal_amount || 0) * (x.interest_rate || 0) / 100)
}, 0)
```

---

## Budget & Planning Logic (`Plan.jsx`)

### Budget Resolution (Monthly Mode)
For a given category and month, the effective budget is resolved as:
1. Look for a budget WITH `month === selectedMonth` (specific override)
2. If none: fallback to budget WHERE `month === null` (default budget)

### Net Worth Projection
```
projectedNW = currentNW compounded monthly at (weightedAnnualRate / 12)  
            + monthly savings surplus added each month

- weightedAnnualRate = expectedAnnualReturn / currentNW  (or 8% fallback)
- Monthly savings = max(0, projectedIncome - projectedExpense) OR user override
```

### Cumulative Savings Plan Table ("Tổng tích luỹ" column)
The per-month plan table starts at the **real current month** (i=0) and accumulates each month's `monthSaving` (= planned surplus `income − expense`, or the user override) into a running `cumulativeSavings`.

- **Base (starting value)** = `currentTotalSavings − currentMonthProjected`, i.e. the **actual accumulation up to BEFORE the current month**.
  - `currentTotalSavings` = sum of `principal_amount` of active savings books whose category name is exactly **"tiết kiệm"** (the real accumulated total *as of now*).
  - `currentMonthProjected` = the **projected** surplus of the current month = `thu dự kiến − chi dự kiến` (`calculateMonthlyStats(currentMonthKey).surplus`, or the per-month override if set). It is **NOT** the actual savings opened this month.
- **Why subtract the projected current month:** the i=0 row adds `monthSaving(currentMonth)` (which equals `currentMonthProjected`), so the two cancel and the current-month row resolves to exactly `currentTotalSavings`. The projected surplus then only accrues from the **next** month onward:
  ```
  Tổng tích luỹ (tháng hiện tại) = (currentTotalSavings − currentMonthProjected) + monthSaving(currentMonth)
                                 = currentTotalSavings
  ```
  matching the requested definition: *tổng tích luỹ thực tế đến trước tháng hiện tại (= tổng tích luỹ thực − tích luỹ **dự kiến** của tháng hiện tại) + tích luỹ dự kiến của tháng hiện tại*.

---

## Category Types

| `type` value | Usage |
|---|---|
| `'income'` | Income categories (Lương, Thưởng…) — "Khoản Thu" tab |
| `'expense'` | Expense categories (Sinh hoạt, Nhà ở…) — "Khoản Chi" tab |
| `'savings'` | Transfer/savings categories (Tiết kiệm, Luân chuyển…) — "Chuyển khoản" tab. Used on `transfer` transactions and savings books, NOT on income/expense. New categories created in this tab are stored with `type: activeTab` = `'savings'`. **The `categories.type` CHECK constraint MUST include `'savings'`** — schemas created before v7 only allowed `income/expense/transfer`, so seeding the savings defaults was rejected (only the Chuyển khoản tab ended up empty). Fix: run `supabase_schema_v7_allow_savings_category.sql` (ALTER the CHECK on the live DB). |

Special categories (added later, must exist for correct flows):
- `'Thu hộ'` — income collected on behalf of others
- `'Chi hộ'` — expense paid on behalf of others  
- `'Thu hồi nợ'` — debt recovery (receivable)

### Default categories & the auto loan-mode trap
`DEFAULT_CATEGORIES` (in `lib/db.js`) seeds three groups (display order = `sort_order`):
- **expense:** Sinh hoạt (`is_ui_default`), Gửi về nhà, Chi hộ, Nhà ở, Trả nợ vay (icon 🏦), Học tập, Du lịch, Mua sắm đồ giá trị, Quà cáp, Cho mượn, Y tế, Nhà cho thuê, Chi điều chỉnh.
- **income:** Lương (`is_ui_default`), Cho thuê, Thu hồi nợ, Lãi tiết kiệm, Thu hộ, Cash back, Thưởng, Thu điều chỉnh.
- **savings** (the "Chuyển khoản" tab; `type = 'savings'`): Tiết kiệm (`is_ui_default`), Nhà ở TK, Má gửi, Tất toán sổ tiết kiệm, Luân chuyển.

> **Why ordering/`is_ui_default` matters:** `AddTransactionSheet` auto-switches into **loan-repayment mode** whenever the selected category is `'Trả nợ vay'` (or icon `🏦`). If the default-selected expense category is the loan category, the "+" form wrongly opens in repayment mode. Guard rails: (1) `Sinh hoạt` carries `is_ui_default: true`; (2) the default picker prefers `is_ui_default` → else the first **non-loan** expense category → else fallback. The icon `🏦` is reserved for `Trả nợ vay` only — do not reuse it (e.g. `Lãi tiết kiệm` uses 📈) or it would falsely trigger loan mode.

> **Versioned reseed:** `seedDefaultData` re-runs whenever `settings.category_seed_version` ≠ `CATEGORY_SEED_VERSION`. Grouping key is **case-insensitive + trimmed** (`type|name.trim().toLowerCase()` via `catKey`), so `"sinh hoạt"` and `"Sinh hoạt"` merge. It upserts defaults into the first match (keeping its `id` so transaction/budget references survive, normalizing name/icon, and **deduping** — extra copies are deleted, one kept) and deletes stale `is_default` categories no longer in the list (user-created categories are preserved). Bump `CATEGORY_SEED_VERSION` to push a new default set to all accounts.
>
> **Per-category resilience (post-v7):** each default upsert is wrapped in its own `try/catch`, so one failing category (e.g. a DB CHECK constraint rejecting `type='savings'`) no longer aborts the whole loop — the remaining categories still seed. `category_seed_version` is written **only when there were zero failures** (`seedFailures === 0`), so a partially-failed seed retries on the next startup (e.g. right after you ALTER the CHECK constraint), instead of being permanently marked as done.
>
> **Full wipe resets categories to defaults:** `Settings.handleWipeData` clears every data table including `categories` **and** `settings` (which holds `category_seed_version`), then calls `seedDefaultData()` directly. With the version row gone and the table empty, seeding recreates exactly `DEFAULT_CATEGORIES` from scratch — so a wipe removes all user-created/stray/duplicate categories and leaves only the app defaults. The page reload afterwards re-runs `seedDefaultData()` but the version now matches, so it no-ops (no duplication).

> **MUST run with an active session.** `seedDefaultData` first checks `supabase.auth.getSession()` and returns early if there is no user; it is invoked from `AuthContext.initUserData()` after login, NOT from `App.jsx` mount. Running it pre-session is the bug that duplicated categories (`toArray()` → `[]` so nothing is matched/deleted, while `add()` still inserts). A module-level `seedingInProgress` flag prevents the concurrent `getInitialSession` + `onAuthStateChange(INITIAL_SESSION)` calls from both seeding.

---

## Overdraft Validation Rules

```js
// Blocked for: expense, transfer (from account), repayment (loan)
if (account.sub_type !== 'debt' && account.balance < transactionAmount) {
  // Show error — insufficient funds
}
// NOT blocked for: income, debt sub_type accounts
```

---

## Google Drive Sync (`lib/syncService.js`)

- Manual backup only — NOT automatic. Google here is **for backup only**, not app login.
- `uploadToDrive()` — exports all **Supabase** tables (`exportFullBackup`, format `finance_tracker_supabase`) + relevant `localStorage` (loan profiles, savings plan, theme) as JSON, uploads to Drive (`appDataFolder` single-file, or timestamped file in a chosen folder).
- `downloadFromDrive()` / `importFullBackup()` — downloads JSON and restores (WIPES current Supabase data first, then re-inserts parent→child order to satisfy FKs). **Backward compatible**: detects old Dexie-format backups and converts via `convertDexieFormat()`.
- OAuth via Google Identity Services (`VITE_GOOGLE_CLIENT_ID`); token cached in-memory.
- Last sync timestamp stored in `db.settings` key `lastDriveSync`; comparison via `checkRemoteBackup()`.
- Also supports manual JSON export/download and File System Access API folder writes, plus CSV export (Settings page, via `xlsx`).
- **Drive folder config persistence:** the chosen Google Drive folder (`googleDriveFolder`, object `{id, name}`) is stored in `settings`. The `settings.value` column is **TEXT**, so object/array values MUST be `JSON.stringify`-ed on write and `JSON.parse`-ed on read — handled centrally in `SupabaseTableWrapper` (`serializeSettingValue` on add/put, `deserializeSettingRow` on get/toArray, only for the `settings` table; values that don't start with `{`/`[` are left untouched so plain strings like `last_updated_at`/`category_seed_version` are preserved). Writing a raw object made Supabase reject the row, so the folder selection silently failed to persist and was lost (`undefined`) on every reload. **Any future object-valued setting** (e.g. Plan.jsx `expected_total_savings_map_*`, `savings_plan_map_*`) relies on this same central handling.
- **Backup folder handle is device-local:** the chosen `FileSystemDirectoryHandle` (File System Access API, separate from the Drive folder) is persisted in a local IndexedDB store (`localHandleStore.js`), NOT in Supabase — handles are structured-cloneable but not JSON-serializable, so they can never round-trip through the `settings` table.

> **`last_updated_at` (data-change tracking):** `settings.last_updated_at` is the "most recent change" marker shown on the Settings data-management screen and used to compare local data freshness against the latest Drive backup. It is bumped **automatically on every real data mutation** via `touchLastModified()` — fired (debounced 1.2s) inside every `SupabaseTableWrapper` write method for all tables **except `settings`** (the exclusion prevents infinite recursion, since `updateLastModified()` itself writes to `settings`). The debounce collapses bursts (multi-account balance updates, category seeding, full backup restore) into a single write. Restore/sync and the loan calculator also call `updateLastModified()` explicitly for an immediate write.

---

## Defensive Programming Standards

To prevent "white screen" crashes, all UI components must follow these safeguards:

### 1. Calculation Guards (Financial Arithmetic)
NEVER perform arithmetic on raw database properties. Always cast to Number and provide a fallback.
```js
// INSECURE
const total = items.reduce((sum, item) => sum + item.amount, 0) 

// SECURE
const total = items.reduce((sum, item) => {
  const val = Number(item.amount) || 0
  return sum + val
}, 0)
```

### 2. Icon Resilience
When using icons (e.g., Lucide), always ensure the component doesn't crash if the icon name is missing or the import fails.
```js
// Standard fallback pattern for dynamic icons
const IconComponent = Icons[iconName] || Icons.HelpCircle
```

### 3. Date Safety
Always provide a fallback for date inputs or display.
```js
const dateStr = record.date || new Date().toISOString().split('T')[0]
```

---

## Interest Rate Handling Standards

To ensure consistent decimal handling (comma for display, dot for storage) and prevent data corruption (like values being reset to 0 mid-typing):

### 1. RateInput Usage
Always use the `RateInput` component for interest rates. It manages a local string state for the display and propagates a numeric value to the parent.

### 2. Propagation Logic
The `onChange` callback should only be triggered if the parsed value is a valid number to prevent "partial" strings (like `8,`) from being saved as `0`.
```js
const handleChange = (e) => {
  const raw = e.target.value;
  if (!/^[\d,\.]*$/.test(raw)) return;
  setDisplay(raw);

  const parsed = fromViDecimal(raw);
  if (!isNaN(parsed)) {
    onChange(parsed);
  }
};
```

### 3. Parse/Format Helpers
Always import and use `toViDecimal(num)` for display and `fromViDecimal(str)` for parsing from `utils/format.js`.
- `toViDecimal(8.5)` -> `"8,5"`
- `fromViDecimal("8,5")` -> `8.5`

---

## formatCurrency Usage

```js
import { formatCurrency } from '../utils/format';

// Always use formatCurrency for displaying monetary values
// UPDATE: formatCurrency is now NaN-safe. If NaN is passed, it returns "0" instead of crashing.
formatCurrency(NaN) // → "0"

formatCurrency(1500000) // → "1.500.000" (vi-VN locale, dots as thousand separators)

// Display pattern
`${formatCurrency(amount)} ₫`
// or for large values
`${(amount / 1e9).toFixed(2)} tỷ ₫`   // ≥ 1 billion
`${(amount / 1e6).toFixed(1)} triệu ₫` // ≥ 1 million
```

---

## Notes Feature (`notes` Table & `/notes` Route)

The **Ghi chú** feature enables users to record financial reminders (e.g. temporary savings book withdrawals) and app enhancement notes.
- **Table**: `notes` (`id`, `user_id`, `title`, `content`, `category`, `is_completed`, `created_at`, `updated_at`).
- **Dynamic Categories**: Categories are stored as string values (e.g. `'Tài chính'`, `'Ứng dụng'`) and support custom user-defined categories. Category filter chips in `Notes.jsx` dynamically aggregate categories from the user's notes.
- **Timestamping**: Displays formatted creation timestamp (`created_at`) on note cards.
- **Integrations**: Standalone screen `/notes`, desktop `SidebarNav` menu item, header shortcut, and a recent notes widget on `Home.jsx`.
