# FinanceTracker — Business Logic & Financial Calculations

## Account Sub-Type Classification

The `sub_type` field on `accounts` drives ALL financial calculations. This is the most critical taxonomy:

| `sub_type` | Example accounts | Treatment in Net Worth |
|---|---|---|
| `'payment'` | Ví/Cash, Ngân hàng, Ví điện tử | **Asset** — included in total assets |
| `'savings'` | Sổ tiết kiệm (via `savings` table) | **Asset** — tracked separately |
| `'receivable'` | Phải thu | **Asset** — included in total assets |
| `'debt'` | Thẻ tín dụng, Khoản nợ | **Liability** — subtracted from net worth |

> **Migration note**: `Phải thu` accounts were migrated from `sub_type: 'debt'` to `sub_type: 'receivable'` in DB version 2.

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

### Total Liabilities
```
totalAllLiabilities = totalDebtAccounts + activeLoans + unlinkedInvestmentDebts
```

**Detail:**
```js
// Debt sub_type accounts (credit cards, loan accounts)
totalDebtAccounts = accounts
  .filter(acc => acc.sub_type === 'debt')
  .reduce((sum, acc) => sum + (acc.balance || 0), 0)

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
globalNetWorth = totalAssetsGross - totalAllLiabilities
```

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

| `type` value | Description | Effect on account `balance` |
|---|---|---|
| `'income'` | Thu nhập | + (increases balance) |
| `'expense'` | Chi tiêu | - (decreases balance) |
| `'transfer'` | Chuyển tiền | - from_account, + to_account |
| `'loan_repayment'` | Trả nợ vay | - from_account (payment amount), calls `updateLoanBalance(principalPaid)` |

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
2. **Category Selection**: User selects an expense category for the transaction (defaults to a "Tiết kiệm" category if found).
3. **Balance Validation**: System blocks the creation if `account.balance < principal_amount`.
4. **Account Update**: `account.balance -= principal_amount`.
5. **Transaction Creation**: A new transaction of type `'expense'` is created with the chosen `account_id` and `category_id` to log the withdrawal.
6. **Savings Record**: A new record is added to `db.savings` containing `account_id` for tracking source.

### 2. Interest Calculation (for Plan projection)
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

---

## Category Types

| `type` value | Usage |
|---|---|
| `'income'` | Income categories (Thu nhập, Tiền lương…) |
| `'expense'` | Expense categories (Ăn uống, Đi lại…) |

Special categories (added later, must exist for correct flows):
- `'Thu hộ'` — income collected on behalf of others
- `'Chi hộ'` — expense paid on behalf of others  
- `'Thu hồi nợ'` — debt recovery (receivable)

---

## Overdraft Validation Rules

```js
// Blocked for: expense, transfer (from account), loan_repayment
if (account.sub_type !== 'debt' && account.balance < transactionAmount) {
  // Show error — insufficient funds
}
// NOT blocked for: income, debt sub_type accounts
```

---

## Google Drive Sync (`lib/syncService.js`)

- Manual backup only — NOT automatic.
- `uploadToDrive()` — exports entire Dexie DB as JSON, uploads to Drive.
- `downloadFromDrive()` — downloads JSON and restores (WIPES current data first).
- OAuth handled via browser-based Google Sign-In popup.
- Last sync timestamp stored in `db.settings.get('lastDriveSync')`.

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
