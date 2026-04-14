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

---

## Savings Interest Calculation (for Plan projection)

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

## formatCurrency Usage

```js
import { formatCurrency } from '../utils/format';

// Always use formatCurrency for displaying monetary values
formatCurrency(1500000) // → "1.500.000" (vi-VN locale, dots as thousand separators)

// Display pattern
`${formatCurrency(amount)} ₫`
// or for large values
`${(amount / 1e9).toFixed(2)} tỷ ₫`   // ≥ 1 billion
`${(amount / 1e6).toFixed(1)} triệu ₫` // ≥ 1 million
```
