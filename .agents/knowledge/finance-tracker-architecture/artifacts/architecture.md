# FinanceTracker — Project Architecture & Tech Stack

## Quick Reference
- **Root**: `/Users/vinhhuynh/Documents/Work/Projects/FinanceTracker/`
- **Frontend root**: `frontend/`
- **Entry point**: `frontend/src/main.jsx` → `App.jsx`
- **Local dev**: `npm run dev` (Vite)

---

## Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | React | ^19 | Functional + hooks |
| Build | Vite | ^8 | Dev server |
| CSS | Tailwind CSS | **v4** | `@import "tailwindcss"` in `index.css` — NO `tailwind.config.js`! |
| Dark Mode | Tailwind `dark:` | — | Class-based via `.dark` on `<html>`. Requires `@custom-variant dark (&:where(.dark, .dark *));` in `index.css` |
| Animation | Framer Motion | ^12 | Used in `BottomSheet`, transitions |
| Icons | lucide-react | ^1.7 | Consistent icon library |
| Database | Dexie.js | ^4 | IndexedDB ORM — local-first, NO Supabase |
| Routing | React Router | ^7 | `BrowserRouter` with nested routes |
| Charts | Recharts | ^3 | `BarChart`, `PieChart`, `AreaChart` |

---

## Directory Structure

```
frontend/src/
├── App.jsx                    # Root: ThemeProvider > AuthProvider > BrowserRouter
├── index.css                  # Tailwind v4: @import + @custom-variant dark
├── main.jsx                   # ReactDOM.createRoot
├── contexts/
│   ├── AuthContext.jsx         # Local PIN auth — user is { id: 'local' } when unlocked
│   └── ThemeContext.jsx        # Dark/light theme — persists to localStorage
├── hooks/
│   ├── useCurrencyInput.js     # Currency input with shortcut mode (x1000)
│   └── useLoans.js             # Loan CRUD + updateLoanBalance
├── lib/
│   ├── db.js                  # Dexie DB definition (version 2)
│   └── syncService.js         # Google Drive backup/restore (manual)
├── utils/
│   ├── format.js              # formatCurrency (vi-VN locale), parseCurrencyInput
│   └── loanCalculator.js      # Amortization schedule generator
├── pages/
│   ├── Home.jsx               # Dashboard — net worth, charts, recent transactions
│   ├── Accounts.jsx           # Account list + grouped view (cash, savings, investments, debt)
│   ├── Plan.jsx               # Budget planning — monthly & default modes + 120-month projection
│   ├── Statistics.jsx         # Bar/pie/area charts, annual summaries
│   ├── Settings.jsx           # App settings (Google Drive, categories, PIN, dark mode)
│   ├── TransactionsList.jsx   # Full scrollable transaction history with filters
│   └── auth/Login.jsx         # PIN entry/setup screen
└── components/
    ├── layout/
    │   ├── MobileLayout.jsx   # Max-width wrapper + BottomTabBar + safe-area
    │   ├── BottomTabBar.jsx   # 5-tab nav: Tổng quan / Tài khoản / Kế hoạch / Thống kê / Cài đặt
    │   └── ProtectedRoute.jsx # Guards — redirects to /login if user is null
    ├── ui/
    │   └── BottomSheet.jsx    # Base modal sheet (Framer Motion spring animation)
    ├── transactions/
    │   ├── AddTransactionSheet.jsx   # Add income/expense/transfer + loan repayment flow
    │   └── EditTransactionSheet.jsx  # Edit/delete transaction
    ├── accounts/
    │   └── AddAccountSheet.jsx       # Add account with type selection
    ├── wealth/
    │   ├── AddSavingsSheet.jsx        # Add savings book
    │   ├── EditSavingsSheet.jsx       # Edit savings book
    │   ├── AddInvestmentSheet.jsx     # Add investment (stocks, real estate, crypto…)
    │   └── EditInvestmentSheet.jsx    # Edit investment
    ├── loans/
    │   └── AddLoanSheet.jsx          # Add loan profile
    ├── budgets/
    │   ├── AddBudgetSheet.jsx         # Add income/expense budget
    │   └── EditBudgetSheet.jsx        # Edit budget
    ├── goals/
    │   ├── AddGoalSheet.jsx           # Savings goal
    │   └── FundGoalSheet.jsx          # Add funds to goal
    ├── settings/
    │   ├── CategoryManagementSheet.jsx
    │   └── ChangePinSheet.jsx
    └── tools/
        ├── LoanCalculatorSheet.jsx    # Loan calculator tool
        └── CompoundInterestSheet.jsx  # Compound interest tool
```

---

## App Routing (`App.jsx`)

```
/login            → <Login />  (Standalone, no bottom tab)
/                 → <MobileLayout> (ProtectedRoute)
  /               → <Home />
  /accounts       → <Accounts />
  /plan           → <Plan />
  /statistics     → <Statistics />
  /settings       → <Settings />
/transactions     → <TransactionsList /> (Standalone, no bottom tab)
```

---

## Contexts

### `AuthContext`
- **Single user, local-first**: No cloud accounts. User object = `{ id: 'local' }` when unlocked.
- PIN stored in `db.settings.get('appLockPin')`.
- Key functions: `unlock(pin)`, `setupPin(pin)`, `updatePin(oldPin, newPin)`, `signOut()`.
- Use `const { user } = useAuth()` throughout app. `user === null` means locked.

### `ThemeContext`
- Reads/writes `localStorage.getItem('theme')` → `'dark'` or `'light'`.
- On change: adds/removes `.dark` class on `document.documentElement`.
- **CRITICAL**: Tailwind v4 dark mode only works with `@custom-variant dark (&:where(.dark, .dark *));` in `index.css`.
- Use `const { theme, toggleTheme } = useTheme()`.

---

## Database Schema (`lib/db.js` — Dexie v2)

```
settings:     key, value
accounts:     id, name, type, sub_type, balance, currency, icon, color_hex, is_default, include_in_net_worth, status
categories:   id, name, type, icon, color_hex, parent_id, is_default
transactions: id, account_id, category_id, amount, date, type, note, tags
loans:        id, account_id, name, total_amount, interest_rate, term_months, start_date, type, status, minimum_payment, payment_date, interest_type, next_payment_amount, remaining_principal, linked_investment_id
budgets:      id, category_id, amount, month, type
investments:  id, account_id, symbol, name, type, buy_price, quantity, purchase_date, current_price, initial_amount, maturity_date, interest_rate, interest_type, auto_renew, status, return_rate, loan_amount
savings:      id, account_id, name, principal_amount, interest_rate, term_months, term_unit, start_date, interest_type, auto_renew, status
goals:        id, name, target_amount, current_amount, deadline, icon, color_hex, status
```

### DB Migration History
- **version(1)**: Initial schema
- **version(2)**: Migration — changes `Phải thu` accounts from `sub_type: 'debt'` → `sub_type: 'receivable'`

---

## Key Hooks

### `useCurrencyInput(initialValue, { useShortcut })`
- Returns `{ displayValue, value, handleInputChange, reset, setExternalValue, suffix }`
- **Shortcut mode ON**: Input `"50"` → stored as `50000`. Suffix = `".000 ₫"`.
- **Shortcut mode OFF** (default): Input `"50000"` → stored as `50000`. Suffix = `" ₫"`.
- Always use `value` (not `displayValue`) when saving to DB.

### `useLoans()`
- Returns `{ loans, loading, fetchLoans, addLoan, updateLoan, deleteLoan, updateLoanBalance, suggestInterest }`
- `updateLoanBalance(loanId, principalPaid)` — reduces `remaining_principal`, marks `paid_off` if ≤ 100.
- Auto-syncs linked `investments.loan_amount` when loan is repaid.
